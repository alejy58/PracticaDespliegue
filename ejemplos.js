/*
  ejemplos.js — Variaciones y ampliaciones de código para el proyecto (Express 5 + Mongoose 9 + MongoDB Atlas).
  Formato pedido:
      //Lo que hace - de donde saca la variacion
      Codigo

  El código va dentro de un bloque de comentario para que el fichero sea JS válido
  (node --check ejemplos.js no da errores). Copia cada bloque al fichero que quieras.
  Cada bloque indica qué paquetes hay que instalar.

  Datos reales usados en los ejemplos (creados en tu API en marcha):
    recinto id : 6b06d605ef42c5a33fdb88ed
    evento id  : 6b06d61def42c5a33fdb88ee
    entrada id : 6b06d61def42c5a33fdb88ef (general), 6b06d61def42c5a33fdb88f0 (vip)

  Índice:
    A. Arranque, robustez y seguridad del servidor
    B. Modelos (schemas, índices, hooks, plugins)
    C. Consultas y agregaciones
    D. Rutas y arquitectura
    E. Autenticación, subida de ficheros, formatos de salida
    F. Tiempo real, colas y jobs
    G. Tests
    H. Despliegue, CI y herramientas
    I. Funciones de Node sin librerías
*/

/* =====================================================================
   A. ARRANQUE, ROBUSTEZ Y SEGURIDAD DEL SERVIDOR
   ===================================================================== */

//Reintentos de conexión a MongoDB con backoff - de la doc de Mongoose/MongoDB (conexión resiliente)
/* npm i mongoose (ya está)
function conectarConReintentos(intentos = 5, espera = 3000) {
  return mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
    .catch(async (err) => {
      if (intentos <= 1) throw err;
      console.warn(`Reintentando conexión en ${espera / 1000}s (${intentos} restantes): ${err.message}`);
      await new Promise(r => setTimeout(r, espera));
      return conectarConReintentos(intentos - 1, espera * 2);
    });
}
conectarConReintentos().then(() => app.listen(PORT));
*/

//Graceful shutdown: cerrar servidor y Mongo antes de morir - de la doc de Node (server.close) y de producción
/* const server = app.listen(PORT);
async function apagar(motivo) {
  console.log(`Apagando por ${motivo}`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('unhandledRejection', (razon) => { console.error(razon); apagar('unhandledRejection'); });
process.on('uncaughtException', (err) => { console.error(err); apagar('uncaughtException'); });
*/

//Escuchar eventos de reconexión de Mongoose - de la doc de Mongoose (connection events)
/* mongoose.connection.on('disconnected', () => console.warn('Mongo desconectado'));
mongoose.connection.on('reconnected', () => console.log('Mongo reconectado'));
mongoose.connection.on('error', (err) => console.error('Error de Mongo:', err.message));
*/

//Endpoint de health check para despliegue (Render, Railway, Docker) - de la doc de despliegue / health probes
/* app.get('/health', (req, res) => {
  const estado = mongoose.connection.readyState; // 1 = conectado
  const ok = estado === 1;
  res.status(ok ? 200 : 503).json({
    ok,
    db: mongoose.connection.name,
    uptime: process.uptime(),
    memoriaMB: Math.round(process.memoryUsage().rss / 1048576)
  });
});
*/

//Middleware de errores centralizado (un solo sitio para todos los catch) - de la doc de Express (error handling)
/* function notFound(req, res, next) {
  res.status(404).json({ ok: false, error: `Ruta ${req.originalUrl} no existe` });
}
function manejadorErrores(err, req, res, next) {
  // CastError: ObjectId mal formado (ej. /eventos/abc)
  if (err.name === 'CastError') {
    return res.status(400).json({ ok: false, error: `Id inválido: ${err.value}` });
  }
  // Código 11000: índice único duplicado
  if (err.code === 11000) {
    return res.status(409).json({ ok: false, error: 'Ya existe', campo: Object.keys(err.keyValue) });
  }
  // Validación de schema de Mongoose
  if (err.name === 'ValidationError') {
    return res.status(400).json({ ok: false, error: Object.values(err.errors).map(e => e.message) });
  }
  console.error(err);
  res.status(err.status || 500).json({ ok: false, error: err.message });
}
// Al final de index.js, después de todas las rutas:
app.use(notFound);
app.use(manejadorErrores);
*/

//asyncHandler: wrapper para que los errores de async caigan al middleware de errores - de Express / express-async-handler
/* npm i express-async-handler
const asyncHandler = require('express-async-handler');
router.get('/', asyncHandler(async (req, res) => {
  const eventos = await Evento.find().populate('recinto');
  res.json({ ok: true, data: eventos });
}));
// Nota: Express 5.1+ ya maneja promesas rechazadas por sí solo; el wrapper es la forma de Express 4.
*/

//Quitar todos los try/catch de las rutas y dejar solo el middleware de errores - de la doc de Express 5
/* // Express 5 captura errores de handlers async y los manda al manejador de errores:
router.get('/:id', async (req, res) => {
  const evento = await Evento.findById(req.params.id);
  if (!evento) { res.status(404).json({ ok: false, error: 'Evento no encontrado' }); return; }
  res.json({ ok: true, data: evento });
});
// Sin try/catch. Los fallos de Mongo van al manejadorErrores de index.js.
*/

//Logging de peticiones con morgan - de la doc de Express (middleware de terceros)
/* npm i morgan
const morgan = require('morgan');
app.use(morgan('dev'));            // método, url, status, tamaño, tiempo
app.use(morgan('common'));         // formato de log de servidor estándar
app.use(morgan('combined'));       // con user-agent y referer
app.use(morgan('tiny'));           // mínimo
*/

//Logging estructurado con pino-http (JSON, para producción) - de la doc de pino
/* npm i pino pino-http
const pino = require('pino');
const { pinoHttp } = require('pino-http');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: req => req.url === '/health' },
  customLogLevel: (req, res, err) => err ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
  customProps: req => ({ id: req.id })
}));
*/

//ID de petición para correlar logs - de la práctica de observabilidad
/* const { randomUUID } = require('node:crypto');
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});
*/

//Medidor de tiempo de cada petición - de node:perf_hooks (doc de Node)
/* const { performance } = require('node:perf_hooks');
app.use((req, res, next) => {
  const inicio = performance.now();
  res.on('finish', () => {
    const ms = (performance.now() - inicio).toFixed(1);
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} en ${ms}ms`);
  });
  next();
});
*/

//Config centralizada y validada al arrancar (zod) - de la doc de zod y práctica de 12-factor
/* npm i zod
const { z } = require('zod');
const esquema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().url(),
  LOG_LEVEL: z.enum(['debug','info','warn','error']).default('info')
});
const config = esquema.parse(process.env);   // falla al arrancar si falta algo
module.exports = config;
// En index.js: const config = require('./config'); app.listen(config.PORT)
*/

//Usar Node para cargar .env sin dotenv - de la doc de Node (flag --env-file, Node 20.6+)
/* package.json:
  "scripts": { "start": "node --env-file=.env index.js" }
Y en index.js se borra la línea require('dotenv').config();
*/

//Recargar al cambiar ficheros sin nodemon - de la doc de Node (flag --watch, Node 22+)
/* package.json:
  "scripts": { "dev": "node --watch --env-file=.env index.js" }
*/

//Multinúcleo: cluster para usar todas las CPU - de la doc de Node (node:cluster)
/* const cluster = require('node:cluster');
const os = require('node:os');
if (cluster.isPrimary) {
  const n = Math.min(os.cpus().length, 4);
  for (let i = 0; i < n; i++) cluster.fork();
  cluster.on('exit', (w) => { console.log('Worker muerto, relanzando'); cluster.fork(); });
} else {
  require('./index.js');   // cada worker levanta su servidor; solo uno puede ocupar el puerto
}
*/

//Servidor HTTPS con certificados locales - de la doc de Node (node:https)
/* const https = require('node:https');
const fs = require('node:fs');
const opts = { key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem') };
https.createServer(opts, app).listen(PORT);
*/

//Trust proxy para ir detrás de Nginx (req.ip real) - de la doc de Express (app.set('trust proxy'))
/* app.set('trust proxy', 1);   // 1 = primer proxy
// Ahora req.ip da la IP del cliente, no la del proxy, y req.secure funciona con X-Forwarded-Proto
*/

//Compresión gzip de las respuestas - de la doc de Express (compression)
/* npm i compression
const compression = require('compression');
app.use(compression());   // ahorra ancho de banda en JSON grande
*/

//Helmet: cabeceras de seguridad - de la doc de helmet
/* npm i helmet
const helmet = require('helmet');
app.use(helmet());                       // cabeceras de seguridad por defecto
app.use(helmet.contentSecurityPolicy({ directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"] } }));
*/

//CORS con lista blanca de orígenes - de la doc de cors
/* npm i cors
const cors = require('cors');
const permitidos = ['http://localhost:5173', 'https://mifrontend.vercel.app'];
app.use(cors({
  origin: (origen, cb) => cb(null, !origen || permitidos.includes(origen)),
  credentials: true,
  methods: ['GET','POST','PATCH','DELETE'],
  maxAge: 600
}));
*/

//Rate limiting para evitar abuso - de la doc de express-rate-limit
/* npm i express-rate-limit
const { rateLimit } = require('express-rate-limit');
const limite = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 100,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas peticiones, espera 15 min' }
});
app.use('/eventos', limite);
// Por IP para login: app.use('/login', rateLimit({ windowMs: 60_000, limit: 5 }))
*/

//Limitar el tamaño del JSON que se acepta - de la doc de Express (express.json)
/* app.use(express.json({ limit: '100kb' }));   // evita payloads gigantes
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
*/

//Quitar claves $ y . de la entrada (anti inyección NoSQL) - de la doc de express-mongo-sanitize
/* npm i express-mongo-sanitize
const sanitize = require('express-mongo-sanitize');
app.use(sanitize());   // { "localidad": { "$gt": "" } } deja de ser un operador
// Sin librería, a mano:
function limpiar(obj) {
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (k.startsWith('$') || k.includes('.')) delete obj[k];
      else limpiar(obj[k]);
    }
  }
  return obj;
}
app.use((req, res, next) => { limpiar(req.body); limpiar(req.query); next(); });
*/

//Timeout de servidor: corta conexiones colgadas - de la doc de Node (server timeouts)
/* const server = app.listen(PORT);
server.keepAliveTimeout = 5000;
server.headersTimeout = 6000;      // debe ser mayor que keepAliveTimeout
server.requestTimeout = 30000;     // Node 18+
server.timeout = 120000;           // conexión inactiva
*/

//Timeout por petición (abort) - de la doc de Node (AbortController)
/* app.use((req, res, next) => {
  req.signal = new AbortController().signal;
  const t = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ ok: false, error: 'Timeout del servidor' });
  }, 10000);
  res.on('finish', () => clearTimeout(t));
  next();
});
*/

/* =====================================================================
   B. MODELOS (SCHEMAS, ÍNDICES, HOOKS, PLUGINS)
   ===================================================================== */

//timestamps: campos createdAt/updatedAt automáticos - de la doc de Mongoose (schema options)
/* const recintoSchema = new mongoose.Schema({ // campos }, { timestamps: true });
// Se crean createdAt y updatedAt solos. Se ven en el JSON devuelto.
*/

//Quitar __v y versionKey del JSON que devolvemos - de la doc de Mongoose (toJSON transform)
/* const eventoSchema = new mongoose.Schema({ // campos
  toJSON: {
    versionKey: false,
    transform: (doc, ret) => { delete ret.__v; return ret; },
    virtuals: true          // incluye los virtuales en el JSON
  }
});
*/

//Índice único: no dos recintos con el mismo nombre - de la doc de MongoDB (unique index)
/* recintoSchema.index({ nombre: 1 }, { unique: true });
// Al insertar un duplicado, Mongoose lanza MongoServerError con code 11000.
// Se captura en el middleware de errores (ejemplo de arriba).
*/

//Índice de texto para búsqueda por palabras - de la doc de MongoDB (text index)
/* recintoSchema.index({ nombre: 'text', direccion: 'text', localidad: 'text' });
// Búsqueda:
router.get('/buscar/:texto', async (req, res) => {
  const recintos = await Recinto.find({ $text: { $search: req.params.texto } }).lean();
  res.json({ ok: recintos.length > 0, data: recintos });
});
// Con relevancia:
const r = await Recinto.find({ $text: { $search: 'palacio' } }, { score: { $meta: 'textScore' } })
  .sort({ score: { $meta: 'textScore' } }).lean();
*/

//Índice geoespacial: recintos con coordenadas y búsqueda por cercanía - de la doc de MongoDB (2dsphere)
/* const recintoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  ubicacion: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }   // [longitud, latitud]
  }
});
recintoSchema.index({ ubicacion: '2dsphere' });
// Recintos a menos de 10 km de un punto:
const cerca = await Recinto.find({
  ubicacion: { $near: { $geometry: { type: 'Point', coordinates: [-3.65, 40.42] }, $maxDistance: 10000 } }
}).lean();
// Con distancia en metros:
const conDist = await Recinto.collection.aggregate([
  { $geoNear: { near: { type: 'Point', coordinates: [-3.65, 40.42] }, distanceField: 'distM',
                spherical: true, maxDistance: 20000, key: 'ubicacion' } }
]);
*/

//Índice TTL: documentos que se borran solos (codes de reserva) - de la doc de MongoDB (TTL index)
/* const reservaSchema = new mongoose.Schema({
  codigo: String,
  caduca: { type: Date, default: () => new Date(Date.now() + 15 * 60 * 1000) }
});
reservaSchema.index({ caduca: 1 }, { expireAfterSeconds: 0 });   // se borra al llegar la fecha
*/

//Índice compuesto para las consultas habituales - de la doc de MongoDB (compound index)
/* eventoSchema.index({ recinto: 1, fecha: -1 });   // "eventos de un recinto ordenados por fecha"
*/

//Virtual: campo calculado que no se guarda en la BD - de la doc de Mongoose (virtuals)
/* eventoSchema.virtual('totalEntradas').get(function () {
  return this.entradas.reduce((s, e) => s + e.disponibles, 0);
});
eventoSchema.virtual('valorTotal').get(function () {
  return this.entradas.reduce((s, e) => s + e.precio * e.disponibles, 0);
});
// Se ve en el JSON si toJSON.virtuals = true.
*/

//Methods: funciones sobre un documento - de la doc de Mongoose (document methods)
/* eventoSchema.methods.reservar = async function (tipo, cantidad) {
  const entrada = this.entradas.find(e => e.tipo === tipo);
  if (!entrada) throw new Error(`No existe la entrada ${tipo}`);
  if (entrada.disponibles < cantidad) throw new Error(`Quedan solo ${entrada.disponibles}`);
  await this.model('Evento').updateOne(
    { _id: this._id, 'entradas.tipo': tipo, 'entradas.disponibles': { $gte: cantidad } },
    { $inc: { 'entradas.$.disponibles': -cantidad } }
  );
  entrada.disponibles -= cantidad;
  return entrada;
};
// Uso: const e = await Evento.findById(id); await e.reservar('general', 2);
*/

//Statics: funciones sobre el modelo - de la doc de Mongoose (model statics)
/* eventoSchema.statics.porLocalidad = async function (localidad) {
  const recintos = await this.model('Recinto').find({ localidad }).select('_id').lean();
  return this.find({ recinto: { $in: recintos.map(r => r._id) } }).populate('recinto').sort({ fecha: 1 }).lean();
};
eventoSchema.statics.elMasCaro = function () {
  return this.aggregate([
    { $unwind: '$entradas' }, { $sort: { 'entradas.precio': -1 } }, { $limit: 1 }
  ]);
};
// Uso: const evs = await Evento.porLocalidad('Madrid');
*/

//Pre-save: normalizar datos antes de guardar - de la doc de Mongoose (pre hooks)
/* recintoSchema.pre('save', function () {
  this.localidad = this.localidad.trim().toLowerCase();
  if (this.aforoMaximo) this.aforoMaximo = Number(this.aforoMaximo);
});
*/

//Post-save: lanzar trabajo tras guardar - de la doc de Mongoose (post hooks)
/* eventoSchema.post('save', function (doc) {
  console.log(`Evento creado: ${doc.nombre} (${doc._id})`);
  // Aquí se puede mandar un email, meterlo en una cola, etc.
});
// Post hook con errores:
eventoSchema.post('save', function (err, doc, next) {
  if (err.code === 11000) { next(new Error('Ese evento ya existe')); return; }
  next(err);
});
*/

//Plugin reutilizable: slug automático a partir del nombre - de la práctica con plugins de Mongoose
/* function pluginSlug(campo, destino) {
  return function (schema) {
    schema.pre('save', function () {
      const base = this[campo].toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      this[destino] = base;
    });
    schema.index({ [destino]: 1 }, { unique: true, sparse: true });
  };
}
eventoSchema.plugin(pluginSlug('nombre', 'slug'));
// Ahora: GET /eventos/slug/concierto-de-rock-en-vivo
router.get('/slug/:slug', async (req, res) => {
  const e = await Evento.findOne({ slug: req.params.slug }).populate('recinto');
  if (!e) { res.status(404).json({ ok: false, error: 'No existe' }); return; }
  res.json({ ok: true, data: e });
});
*/

//Plugin de borrado lógico (soft delete) - de la doc de mongoose-delete
/* npm i mongoose-delete
const softDelete = require('mongoose-delete');
recintoSchema.plugin(softDelete, { deletedAt: true });
// Borrar: await Recinto.delete({ _id: id })   // marca deleted: true
// Listar solo vivos: Recinto.find().deleted()
// Listar borrados:   Recinto.find().withDeleted()
// Recuperar:         Recinto.restore({ _id: id })
*/

//Validador propio: el aforo debe cubrir las entradas - de la doc de Mongoose (custom validators)
/* eventoSchema.methods.entradasTotales = function () {
  return this.entradas.reduce((s, e) => s + e.disponibles, 0);
};
eventoSchema.pre('validate', function () {
  const aforo = Number(this.recinto && this.recinto.aforoMaximo);
  if (Number.isFinite(aforo) && this.entradasTotales() > aforo) {
    this.invalidate('entradas', `Las entradas (${this.entradasTotales()}) superan el aforo (${aforo})`);
  }
});
*/

//Validador async: comprobar que el recinto existe antes de guardar el evento - de la doc de Mongoose (async validators)
/* eventoSchema.path('recinto').validate(async function (v) {
  return await this.model('Recinto').exists(v);
}, 'El recinto no existe');
*/

//aforoMaximo como Number con límites (ahora es String) - de la doc de Mongoose (schema types)
/* aforoMaximo: {
  type: Number,
  min: [1, 'El aforo debe ser mayor de 1'],
  max: [100000, 'Aforo imposible'],
  required: true
}
*/

//Enum para los tipos de entrada - de la doc de Mongoose (enum)
/* tipo: {
  type: String,
  required: true,
  enum: ['general', 'vip', 'infantil', 'backstage', 'abono'],
  lowercase: true,
  trim: true
}
*/

//Subdocumentos: añadir, buscar y quitar una entrada - de la doc de Mongoose (subdocuments)
/* const e = await Evento.findById('6b06d61def42c5a33fdb88ee');
e.entradas.push({ tipo: 'backstage', precio: 200, disponibles: 20 });   // push
const entrada = e.entradas.id('6b06d61def42c5a33fdb88ef');              // por id
entrada.precio = 40;
e.entradas.pull(entrada);                                                // quitar
await e.save();
// Solo el subdocumento, sin tocar el resto:
await Evento.updateOne({ _id: id, 'entradas._id': subId }, { $set: { 'entradas.$.precio': 40 } });
*/

//Optimistic concurrency: evitar dos ventas simultáneas sobre la misma entrada - de la práctica con versionKey
/* const e = await Evento.findById(id);            // e.__v vale, por ejemplo, 3
const guardado = await Evento.findOneAndUpdate(
  { _id: e._id, __v: e.__v },                     // solo si la versión sigue siendo 3
  { $inc: { 'entradas.0.disponibles': -1, __v: 1 } },
  { new: true }
);
if (!guardado) { res.status(409).json({ ok: false, error: 'Otro usuario modificó el evento, reintenta' }); }
*/

//Discriminators: eventos con campos extra según tipo - de la doc de Mongoose (discriminators)
/* const base = new mongoose.Schema({ nombre: String, fecha: Date, recinto: { type: mongoose.Schema.Types.ObjectId, ref: 'Recinto' } });
const EventoBase = mongoose.model('EventoBase', base);
const conciertos = new mongoose.Schema({ artista: String, duracionMin: Number });
const Concierto = EventoBase.discriminator('Concierto', conciertos);
const obras = new mongoose.Schema({ compania: String, director: String });
const Obra = EventoBase.discriminator('Obra', obras);
// Se guardan en la misma colección y se filtran por __vname.
*/

//Auditoría: quién creó y quién modificó - de la práctica de auditoría
/* const eventoSchema = new mongoose.Schema({
  // campos del schema,
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  modificadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }
});
eventoSchema.pre('save', function () {
  const user = this.$locals.user;   // se mete desde el middleware de auth
  if (this.isNew) this.creadoPor = user;
  else this.modificadoPor = user;
});
*/

//Modelo Usuario con password cifrado - de la doc de bcryptjs
/* npm i bcryptjs
const bcrypt = require('bcryptjs');
const usuarioSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  pass: { type: String, required: true, select: false },   // select:false: no sale en find
  rol: { type: String, enum: ['lector', 'organizador', 'admin'], default: 'lector' }
});
usuarioSchema.pre('save', async function () {
  if (!this.isModified('pass')) return;
  this.pass = await bcrypt.hash(this.pass, 10);
});
usuarioSchema.methods.comprobarPass = function (clave) { return bcrypt.compare(clave, this.pass); };
module.exports = mongoose.model('Usuario', usuarioSchema);
*/

//Modelo de Reserva con expiración - ampliación del proyecto (control de aforo real)
/* const reservaSchema = new mongoose.Schema({
  evento: { type: mongoose.Schema.Types.ObjectId, ref: 'Evento', required: true },
  tipo: { type: String, required: true },
  cantidad: { type: Number, min: 1, max: 10, required: true },
  estado: { type: String, enum: ['pendiente', 'confirmada', 'cancelada'], default: 'pendiente' },
  caduca: { type: Date, default: () => new Date(Date.now() + 15 * 60 * 1000) }
}, { timestamps: true });
reservaSchema.index({ caduca: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('Reserva', reservaSchema);
*/

/* =====================================================================
   C. CONSULTAS Y AGREGACIONES
   ===================================================================== */

//Paginación con ?pagina= y ?tamano= - de la práctica de APIs REST
/* router.get('/', async (req, res) => {
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const tamano = Math.min(100, Math.max(1, parseInt(req.query.tamano) || 10));
  const [data, total] = await Promise.all([
    Evento.find().populate('recinto').sort({ fecha: 1 }).skip((pagina - 1) * tamano).limit(tamano).lean(),
    Evento.countDocuments()
  ]);
  res.json({ ok: true, data, pagina, tamano, total, paginas: Math.ceil(total / tamano) });
});
*/

//Filtros, orden y proyección desde la query - de la doc de Mongoose (query chaining)
/* const q = Evento.find();
if (req.query.localidad) q.where('recinto').in(req.query.localidad.split(','));
if (req.query.desde) q.where('fecha').gte(new Date(req.query.desde));
if (req.query.hasta) q.where('fecha').lte(new Date(req.query.hasta));
if (req.query.precioMin) q.where('entradas.precio').gte(Number(req.query.precioMin));
q.select('nombre fecha recinto entradas.0').sort(req.query.orden || { fecha: -1 }).limit(50).lean();
const eventos = await q;
res.json({ ok: true, data: eventos });
*/

//countDocuments, distinct y estimatedDocumentCount - de la doc de Mongoose/MongoDB
/* const total = await Evento.countDocuments({ fecha: { $gte: new Date() } });
const localidades = await Recinto.distinct('localidad');            // lista sin duplicados
const aprox = await Evento.estimatedDocumentCount();               // rápido, usa metadatos
res.json({ ok: true, total, localidades, aprox });
*/

//findOneAndUpdate con upsert: crear si no existe - de la doc de MongoDB
/* const doc = await Recinto.findOneAndUpdate(
  { nombre: req.body.nombre },
  req.body,
  { new: true, upsert: true, setDefaultsOnInsert: true }
);   // crea si no lo encuentra, devuelve el resultado actualizado
*/

//Vender entradas de forma atómica con $inc - de la doc de MongoDB ($inc, filtered positional)
/* router.post('/reservar/:id', async (req, res) => {
  const { tipo, cantidad } = req.body;
  const e = await Evento.findOneAndUpdate(
    { _id: req.params.id, 'entradas.tipo': tipo, 'entradas.disponibles': { $gte: cantidad } },
    { $inc: { 'entradas.$[e].disponibles': -cantidad } },
    { new: true, arrayFilters: [{ 'e.tipo': tipo }] }
  );
  if (!e) { res.status(409).json({ ok: false, error: 'No hay suficientes entradas de ese tipo' }); return; }
  res.status(200).json({ ok: true, data: e.entradas.find(x => x.tipo === tipo) });
});
*/

//insertMany y bulkWrite: muchas operaciones de golpe - de la doc de Mongoose
/* await Recinto.insertMany([{ nombre:'A', direccion:'Dirección 1', localidad:'Madrid' },
                            { nombre:'B', direccion:'Dirección 2', localidad:'Barcelona' }],
                           { ordered: false });   // ordered:false sigue si una falla
// bulkWrite:
await Evento.bulkWrite([
  { updateOne: { filter: { _id: id1 }, update: { $inc: { 'entradas.0.disponibles': -2 } } } },
  { deleteOne: { filter: { _id: id2 } } },
  { insertOne: { document: { nombre: 'Nuevo evento', fecha: new Date(), recinto: id1 } } }
]);
*/

//Transacción: vender y crear la reserva a la vez - de la doc de MongoDB (transactions, requiere replica set: Atlas lo tiene)
/* router.post('/comprar/:id', async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { tipo, cantidad } = req.body;
    const e = await Evento.findOneAndUpdate(
      { _id: req.params.id, 'entradas.tipo': tipo, 'entradas.disponibles': { $gte: cantidad } },
      { $inc: { 'entradas.$[e].disponibles': -cantidad } },
      { session, arrayFilters: [{ 'e.tipo': tipo }], new: true }
    );
    if (!e) throw new Error('No hay entradas disponibles');
    const [reserva] = await Reserva.create([{ evento: e._id, tipo, cantidad, estado: 'confirmada' }], { session });
    await session.commitTransaction();
    res.status(201).json({ ok: true, data: { reserva, entradas: e.entradas.find(x => x.tipo === tipo) } });
  } catch (err) {
    await session.abortTransaction();
    res.status(409).json({ ok: false, error: err.message });
  } finally {
    session.endSession();
  }
});
*/

//Aggregate con $lookup: unir eventos y recintos sin populate - de la doc de MongoDB ($lookup)
/* const pipeline = [
  { $match: { fecha: { $gte: new Date() } } },
  { $lookup: { from: 'recintos', localField: 'recinto', foreignField: '_id', as: 'recinto' } },
  { $unwind: '$recinto' },
  { $project: { nombre: 1, fecha: 1, 'recinto.nombre': 1, 'recinto.localidad': 1, aforo: '$recinto.aforoMaximo' } },
  { $sort: { fecha: 1 } },
  { $limit: 20 }
];
const eventos = await Evento.aggregate(pipeline);
*/

//Aggregate: aforo total y número de recintos por localidad - de la doc de MongoDB ($group)
/* const porLocalidad = await Recinto.aggregate([
  { $group: { _id: '$localidad',
              recintos: { $count: true },
              aforoTotal: { $sum: { $convert: { input: '$aforoMaximo', to: 'int' } } } } },
  { $sort: { aforoTotal: -1 } }
]);
*/

//Aggregate: entradas a la venta agrupadas por tipo de evento - de la doc de MongoDB ($unwind, $group)
/* const entradas = await Evento.aggregate([
  { $unwind: '$entradas' },
  { $group: { _id: '$entradas.tipo',
              total: { $sum: '$entradas.disponibles' },
              precioMedio: { $avg: '$entradas.precio' },
              eventos: { $addToSet: '$nombre' } } },
  { $sort: { total: -1 } }
]);
*/

//Aggregate con $facet: datos y total en una sola consulta - de la doc de MongoDB ($facet)
/* const [res] = await Evento.aggregate([
  { $facet: {
      data: [ { $sort: { fecha: -1 } }, { $skip: 0 }, { $limit: 10 } ],
      total: [ { $count: 'n' } ]
    } }
  ]);
res.json({ ok: true, data: res.data, total: res.total[0]?.n ?? 0 });
*/

//Búsqueda por texto sin índices: regex sin mayúsculas - de la doc de MongoDB ($regex)
/* const q = req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');   // escapar para regex segura
const recintos = await Recinto.find({ nombre: { $regex: q, $options: 'i' } }).lean();
*/

//Filtrar eventos que tienen una entrada barata ($elemMatch) - de la doc de MongoDB ($elemMatch)
/* const eventos = await Evento.find({
  entradas: { $elemMatch: { precio: { $lte: 40 }, disponibles: { $gt: 0 } } }
}).lean();
// Solo la entrada que cumple:
const solo = await Evento.find({ entradas: { $elemMatch: { tipo: 'vip' } } })
  .select('nombre entradas.$').lean();
*/

//Contar tipos de entrada ($size) y proyectar el primer elemento - de la doc de MongoDB
/* const conVarias = await Evento.find({ entradas: { $size: 2 } }).select('nombre entradas.0').lean();
*/

//Rango de fechas y solo eventos futuros - de la doc de MongoDB ($gte)
/* const futuros = await Evento.find({ fecha: { $gte: new Date() } }).sort({ fecha: 1 }).limit(10).lean();
const esteMes = await Evento.find({
  fecha: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
           $lt:  new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) }
}).lean();
*/

//Consulta con $expr: comparar campos entre sí - de la doc de MongoDB ($expr)
/* const caras = await Evento.find({ $expr: { $gt: ['$entradas.0.precio', 100] } }).lean();
// Entradas con más disponibles que el aforo del propio evento:
const raros = await Evento.find({ $expr: { $gt: ['$entradas.0.disponibles', '$entradas.1.disponibles'] } }).lean();
*/

//Cursor en streaming para datos grandes - de la doc de Mongoose (query cursor)
/* const cursor = Evento.find().lean().cursor();
res.setHeader('Content-Type', 'application/x-ndjson');
for await (const doc of cursor) {
  res.write(JSON.stringify(doc) + '\n');
}
res.end();
*/

//Lean: consultas de solo lectura mucho más rápidas - de la doc de Mongoose (lean)
/* const eventos = await Evento.find().populate('recinto').lean();
// Devuelve objetos planos, sin métodos de Mongoose. Ideal para responder JSON.
*/

//Poblado selectivo y anidado - de la doc de Mongoose (populate)
/* const e = await Evento.findById(id)
  .populate('recinto', 'nombre direccion localidad')      // solo esos campos
  .lean();
// Poblado con filtro:
const evs = await Evento.find().populate({
  path: 'recinto',
  match: { localidad: 'Madrid' },                        // solo recintos de Madrid
  select: 'nombre aforoMaximo',
  populate: { path: 'creadoPor', select: 'email' }       // nested populate
});
// Poblado de un array:
const evs2 = await Evento.find().populate([{ path: 'recinto', select: 'nombre' }, { path: 'entradas', match: { precio: { $gt: 50 } } }]);
*/

//Virtual populate: eventos dentro del recinto sin campos de referencia - de la doc de mongoose-virtual-populate
/* npm i mongoose-virtual-populate
const { VirtualPopulatePlugin } = require('mongoose-virtual-populate');
recintoSchema.plugin(VirtualPopulatePlugin);
recintoSchema.virtual('eventos', { ref: 'Evento', localField: '_id', foreignField: 'recinto' });
const r = await Recinto.findById(id).populate('eventos');   // recinto con sus eventos
*/

//Change stream: reaccionar a cambios en la BD - de la doc de MongoDB (change streams)
/* const stream = Evento.watch([
  { $match: { operationType: 'insert' } }
]);
stream.on('change', (c) => {
  console.log('Evento nuevo:', c.fullDocument?.nombre);
  // Aquí se puede avisar por websocket a los clientes conectados
});
*/

//Borrar en cascada: borrar un recinto y sus eventos - ampliación del proyecto
/* router.delete('/:id', async (req, res) => {
  const recinto = await Recinto.findById(req.params.id);
  if (!recinto) { res.status(404).json({ ok: false, error: 'Recinto no encontrado' }); return; }
  const n = await Evento.deleteMany({ recinto: req.params.id });
  await recinto.deleteOne();
  res.json({ ok: true, borrados: { recinto: 1, eventos: n.deletedCount } });
});
*/

//Atlas Search: búsqueda con relevancia en MongoDB Atlas - de la doc de Atlas Search
/* Se crea el índice "eventos" en Atlas (Search Index). Luego:
const resultados = await Evento.collection.aggregate([
  { $search: { index: 'eventos',
      text: { query: req.query.q, path: ['nombre', 'entradas.tipo'], fuzzy: { maxEdits: 1 } } } },
  { $limit: 20 },
  { $project: { nombre: 1, fecha: 1, score: { $meta: 'textScore' } } }
]);
*/

//Atlas Search con paginación por faceta - de la doc de Atlas Search
/* const agg = await Evento.collection.aggregate([
  { $search: { index: 'eventos',
      text: { query: req.query.q, path: ['nombre'] },
      returnCount: true },
    limit: 10, skip: (pagina - 1) * 10 },
  { $project: { nombre: 1, count: { $meta: 'searchCountMetadata' } } }
]);
*/

/* =====================================================================
   D. RUTAS Y ARQUITECTURA
   ===================================================================== */

//PUT y PATCH: los métodos que faltan en el proyecto - de la doc de Express
/* router.put('/:id', async (req, res) => {
  const e = await Evento.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!e) { res.status(404).json({ ok: false, error: 'Evento no encontrado' }); return; }
  res.json({ ok: true, data: e });
});
router.patch('/:id', async (req, res) => {
  const e = await Evento.findOneAndUpdate({ _id: req.params.id }, { $set: req.body },
    { new: true, runValidators: true, context: 'query' });
  if (!e) { res.status(404).json({ ok: false, error: 'Evento no encontrado' }); return; }
  res.json({ ok: true, data: e });
});
// runValidators: true hace que los min/max/required se comprueben también en update.
*/

//PATCH de una entrada concreta (subdocumento) - ampliación del proyecto
/* router.patch('/:id/entradas/:subId', async (req, res) => {
  const { precio, disponibles } = req.body;
  const e = await Evento.findOneAndUpdate(
    { _id: req.params.id, 'entradas._id': req.params.subId },
    { $set: { 'entradas.$.precio': precio, 'entradas.$.disponibles': disponibles } },
    { new: true, runValidators: true }
  );
  if (!e) { res.status(404).json({ ok: false, error: 'Entrada no encontrada' }); return; }
  res.json({ ok: true, data: e.entradas.id(req.params.subId) });
});
*/

//Validación de entrada con express-validator - de la doc de express-validator
/* npm i express-validator
const { body, validationResult } = require('express-validator');
router.post('/', [
  body('nombre').trim().isLength({ min: 5 }).withMessage('Nombre demasiado corto'),
  body('fecha').isISO8601().withMessage('Fecha inválida'),
  body('recinto').isMongoId().withMessage('Recinto inválido'),
  body('entradas').isArray({ min: 1 }).withMessage('Al menos una entrada'),
  body('entradas.*.tipo').isString().isLength({ min: 3 }),
  body('entradas.*.precio').isFloat({ min: 0 }),
  body('entradas.*.disponibles').isInt({ min: 0 })
], async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, error: errores.array().map(e => e.msg) });
    return;
  }
  const e = await Evento.create(req.body);
  res.status(201).json({ ok: true, data: e });
});
*/

//Validación con zod (misma idea, sin dependencias de Express) - de la doc de zod
/* const { z } = require('zod');
const eventoZ = z.object({
  nombre: z.string().min(5),
  fecha: z.coerce.date(),
  recinto: z.string().length(24),
  entradas: z.array(z.object({ tipo: z.string().min(3), precio: z.number().min(0), disponibles: z.number().int().min(0) })).min(1)
});
router.post('/', async (req, res) => {
  const r = eventoZ.safeParse(req.body);
  if (!r.success) { res.status(400).json({ ok: false, error: r.error.issues.map(i => `${i.path}: ${i.message}`) }); return; }
  const e = await Evento.create(r.data);
  res.status(201).json({ ok: true, data: e });
});
*/

//Middleware para validar que el :id es un ObjectId - de la doc de mongoose (Types.ObjectId.isValid)
/* const { Types } = require('mongoose');
function idValido(req, res, next) {
  if (!Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ ok: false, error: 'Id no válido' });
    return;
  }
  next();
}
router.get('/:id', idValido, async (req, res) => { // handler normal });
*/

//Separar controladores de las rutas (capa de controladores) - de la práctica de arquitectura MVC
/* // controllers/eventos.js
const Evento = require('../models/evento');
exports.listar = async (req, res) => { res.json({ ok: true, data: await Evento.find().populate('recinto').lean() }); };
exports.crear  = async (req, res) => { res.status(201).json({ ok: true, data: await Evento.create(req.body) }); };
// routes/eventos.js
const c = require('../controllers/eventos');
router.get('/', c.listar);
router.post('/', c.crear);
*/

//Capa de servicio: la lógica fuera del controlador - de la práctica de arquitectura
/* // services/eventos.js
const Evento = require('../models/evento');
const Recinto = require('../models/recinto');
async function crearEvento(datos, usuario) {
  const recinto = await Recinto.findById(datos.recinto);
  if (!recinto) throw Object.assign(new Error('El recinto no existe'), { status: 400 });
  const total = datos.entradas.reduce((s, e) => s + e.disponibles, 0);
  if (total > Number(recinto.aforoMaximo)) throw Object.assign(new Error('Supera el aforo'), { status: 409 });
  return Evento.create({ ...datos, creadoPor: usuario });
}
module.exports = { crearEvento };
// controllers/eventos.js
exports.crear = async (req, res, next) => {
  try { res.status(201).json({ ok: true, data: await crearEvento(req.body, req.user) }); }
  catch (e) { next(e); }
};
*/

//Encadenar rutas en un solo router.route() - de la doc de Express
/* router.route('/')
  .get(listar)
  .post(crear);
router.route('/:id')
  .get(uno)
  .patch(modificar)
  .delete(borrar);
*/

//Router con mergeParams: sub-rutas de un evento - de la doc de Express
/* const entradasRouter = express.Router({ mergeParams: true });   // ve req.params.id de /eventos/:id
entradasRouter.route('/')
  .get((req, res) => { // listar entradas de req.params.id })
  .post((req, res) => { // crear entrada });
router.route('/:id/entradas').use(entradasRouter);
// Ahora: GET/POST /eventos/6b06d61def42c5a33fdb88ee/entradas
*/

//Versionado de API: /api/v1 y /api/v2 - de la práctica de APIs
/* app.use('/api/v1', require('./routes/v1'));
app.use('/api/v2', require('./routes/v2'));
// v1 devuelve { ok, data }; v2 devuelve { data, meta, links }
*/

//Respuesta 201 con cabecera Location - de la práctica REST
/* router.post('/', async (req, res) => {
  const e = await Evento.create(req.body);
  res.status(201).location(`/api/eventos/${e._id}`).json({ ok: true, data: e });
});
*/

//Borrar devolviendo 204 sin cuerpo - de la práctica REST
/* router.delete('/:id', async (req, res) => {
  const e = await Evento.findByIdAndDelete(req.params.id);
  if (!e) { res.status(404).json({ ok: false, error: 'No encontrado' }); return; }
  res.status(204).end();
});
*/

//Cache en memoria con caducidad - de la práctica (sin librería)
/* const cache = new Map();
function conCache(ms = 30000) {
  return async (req, res, next) => {
    const clave = req.originalUrl;
    const hit = cache.get(clave);
    if (hit && hit.expira > Date.now()) { res.json(hit.datos); return; }
    res.json = (function (original) {
      return function (datos) {
        cache.set(clave, { datos, expira: Date.now() + ms });
        original.call(res, datos);
      };
    })(res.json);
    next();
  };
}
app.use('/eventos', conCache(30000));
// Limpieza: setInterval(() => { for (const [k, v] of cache) if (v.expira < Date.now()) cache.delete(k); }, 60000).unref();
*/

//Cache en Redis - de la doc de redis
/* npm i redis
const { createClient } = require('redis');
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();
async function cacheRedis(segundos) {
  return (req, res, next) => {
    const clave = req.originalUrl;
    const guardado = await redis.get(clave);
    if (guardado) { res.type('application/json').send(guardado); return; }
    const original = res.send.bind(res);
    res.send = (body) => { redis.set(clave, body, { EX: segundos }); original(body); };
    next();
  };
}
app.use('/eventos', cacheRedis(30));
*/

//ETag para que el cliente use caché - de la doc de Express (res.etag)
/* const crypto = require('node:crypto');
router.get('/', async (req, res) => {
  const datos = await Evento.find().lean();
  const hash = crypto.createHash('sha1').update(JSON.stringify(datos)).digest('hex');
  res.set('ETag', hash);
  if (req.get('If-None-Match') === hash) { res.status(304).end(); return; }
  res.json({ ok: true, data: datos });
});
*/

//Rate limit por usuario autenticado - de la doc de express-rate-limit
/* const limiter = rateLimit({
  windowMs: 60_000, limit: 20,
  keyGenerator: (req) => req.user ? req.user._id : req.ip
});
*/

//Idempotencia: POST repetido no crea dos veces - de la práctica de APIs de pago
/* app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const clave = req.headers['x-idempotency-key'];
  if (!clave) return next();
  res.setHeader('X-Idempotency-Key', clave);
  next();
});
// En la ruta: guardar la clave en una colección Idempotencia y devolver la respuesta guardada si se repite.
*/

//Documentación interactiva con Swagger - de la doc de swagger-ui-express
/* npm i swagger-jsdoc swagger-ui-express
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const spec = swaggerJsdoc({
  definition: { openapi: '3.0.0', info: { title: 'API de Eventos', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }] },
  apis: ['./routes/*.js']
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
// En las rutas se documenta con un bloque de comentario encima de cada handler:
//   GET /eventos
//   @openapi
//   /eventos:
//     get:
//       summary: Listar eventos
//       responses:
//         200: { description: Lista de eventos }
*/

//Validar requests y respuestas contra el OpenAPI - de la doc de express-openapi-validator
/* npm i express-openapi-validator
const OpenApiValidator = require('express-openapi-validator');
app.use(OpenApiValidator.middleware({ schemaPath: './openapi.yaml' }));
*/

//Metrics Prometheus - de la doc de prom-client
/* npm i prom-client
const client = require('prom-client');
const httpDur = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duración de peticiones',
  buckets: [10, 50, 100, 500, 1000],
  labels: ['method', 'route', 'status']
});
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => httpDur.observe({ labels: { method: req.method, route: req.route?.path || req.path, status: res.statusCode }, value: Date.now() - t }));
  next();
});
const eventosActivos = new client.Gauge({ name: 'eventos_activos', help: 'Eventos',
  async () => await Evento.countDocuments({ fecha: { $gte: new Date() } }) });
app.get('/metrics', async (req, res) => { res.set('Content-Type', client.contentType); res.end(await client.register.metrics()); });
*/

/* =====================================================================
   E. AUTENTICACIÓN, FICHEROS Y FORMATOS
   ===================================================================== */

//Login que firma un JWT - de la doc de jsonwebtoken
/* npm i jsonwebtoken
const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario');
router.post('/login', async (req, res) => {
  const u = await Usuario.findOne({ email: req.body.email }).select('+pass');
  if (!u || !(await u.comprobarPass(req.body.pass))) {
    res.status(401).json({ ok: false, error: 'Credenciales incorrectas' }); return;
  }
  const token = jwt.sign({ sub: u._id, rol: u.rol }, process.env.SECRETO, { expiresIn: '1h' });
  res.json({ ok: true, data: { token, rol: u.rol } });
});
*/

//Middleware que exige JWT en las rutas protegidas - de la doc de jsonwebtoken
/* function protege(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ ok: false, error: 'Falta token' }); return; }
  try {
    req.user = jwt.verify(token, process.env.SECRETO);
    next();
  } catch (e) {
    res.status(401).json({ ok: false, error: 'Token inválido o caducado' });
  }
}
function exigeRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) { res.status(403).json({ ok: false, error: 'Sin permiso' }); return; }
    next();
  };
}
router.post('/', protege, exigeRol('organizador', 'admin'), crear);
router.delete('/:id', protege, exigeRol('admin'), borrar);
*/

//Cookies y sesión - de la doc de cookie-parser y express-session
/* npm i cookie-parser express-session
const cookieParser = require('cookie-parser');
const session = require('express-session');
app.use(cookieParser());
app.use(session({ secret: process.env.SECRETO, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax' } }));
// req.cookies.token, req.session.userId
*/

//Subida de un fichero (cartel del evento) - de la doc de multer
/* npm i multer
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(file.mimetype.startsWith('image/') ? null : new Error('Solo imágenes'), true)
});
router.post('/cartel/:id', upload.single('cartel'), async (req, res) => {
  if (!req.file) { res.status(400).json({ ok: false, error: 'Falta el fichero' }); return; }
  const e = await Evento.findByIdAndUpdate(req.params.id, { cartel: req.file.buffer }, { new: true });
  res.status(201).json({ ok: true, data: { nombre: req.file.originalname, tamano: req.file.size } });
});
// Servirlo: app.get('/cartel/:id', async (req,res) => { const e = await Evento.findById(req.params.id); res.type('image/jpeg').send(e.cartel); });
*/

//Descargar los eventos en CSV - de la doc de @json2csv/plainjs
/* npm i @json2csv/plainjs
const { parse } = require('@json2csv/plainjs');
router.get('/csv', async (req, res) => {
  const eventos = await Evento.find().populate('recinto').lean();
  const filas = eventos.map(e => ({
    nombre: e.nombre, fecha: e.fecha, localidad: e.recinto?.localidad,
    aforo: e.recinto?.aforoMaximo, entradas: e.entradas.map(x => `${x.tipo}:${x.precio}`).join(' ')
  }));
  const csv = parse(filas);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="eventos.csv"');
  res.send(csv);
});
*/

//Generar un PDF con pdfkit - de la doc de pdfkit
/* npm i pdfkit
const PDFDocument = require('pdfkit');
router.get('/ticket/:id', async (req, res) => {
  const e = await Evento.findById(req.params.id).populate('recinto');
  if (!e) { res.status(404).json({ ok: false, error: 'No encontrado' }); return; }
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);
  doc.fontSize(20).text('Entrada', { align: 'center' });
  doc.moveDown(); doc.fontSize(14).text(e.nombre);
  doc.fontSize(11).text(`Fecha: ${e.fecha.toLocaleString('es-ES')}`);
  doc.text(`Lugar: ${e.recinto.nombre}, ${e.recinto.direccion}`);
  doc.end();
});
*/

//Plantillas HTML con ejs - de la doc de ejs
/* npm i ejs
app.set('view engine', 'ejs');
app.set('views', './vistas');
app.get('/', (req, res) => res.render('index', { titulo: 'API de Eventos' }));
// vistas/index.ejs: <h1><%= titulo %></h1>
*/

//Servir ficheros estáticos (frontend sencillo) - de la doc de Express
/* app.use(express.static('public'));   // public/index.html en http://localhost:3000/
*/

/* =====================================================================
   F. TIEMPO REAL, COLAS Y JOBS
   ===================================================================== */

//WebSockets: avisar cuando se crea un evento - de la doc de socket.io
/* npm i socket.io
const { Server } = require('socket.io');
const http = require('node:http');
const server = http.createServer(app);
const io = new Server(server);
io.on('connection', (s) => {
  s.join('eventos');
  s.on('disconnect', () => {});
});
// En el post de eventos:
io.to('eventos').emit('evento-nuevo', { nombre: e.nombre });
server.listen(PORT);
*/

//Server-Sent Events (SSE) para streaming de datos - de la doc de HTML/Express
/* router.get('/stream', async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const cursor = Evento.find().lean().cursor();
  for await (const doc of cursor) {
    res.write(`event: evento\ndata: ${JSON.stringify(doc)}\n\n`);
  }
  res.write('event: fin\ndata: {}\n\n');
  res.end();
});
*/

//Job programado: avisar de eventos que empiezan mañana - de la doc de node-cron
/* npm i node-cron
const cron = require('node-cron');
cron.schedule('0 9 * * *', async () => {   // cada día a las 9:00
  const manana = new Date(Date.now() + 24 * 3600 * 1000);
  const eventos = await Evento.find({ fecha: { $gte: new Date(), $lt: manana } }).populate('recinto');
  console.log(`${eventos.length} eventos mañana`);
});
cron.schedule('0,10,20,30,40,50 * * * *', async () => {   // cada 10 min: limpiar reservas caducadas
  await Reserva.deleteMany({ estado: 'pendiente', caduca: { $lt: new Date() } });
});
*/

//Cola de trabajos con BullMQ - de la doc de BullMQ
/* npm i bullmq ioredis
const { Queue, Worker } = require('bullmq');
const cola = new Queue('avisos', { connection: { host: '127.0.0.1', port: 6379 } });
const worker = new Worker('avisos', async (job) => {
  console.log('Enviando aviso de', job.data.nombre);
});
// En la ruta: await cola.add({ nombre: e.nombre });
*/

//Webhook firmado: recibir avisos de otro sistema - de la práctica de webhooks
/* const crypto = require('node:crypto');
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const firma = req.headers['x-hub-signature-256'];
  const esperada = 'sha256=' + crypto.createHmac('sha256', process.env.SECRETO).update(req.body).digest('hex');
  if (firma !== esperada) { res.status(401).json({ ok: false, error: 'Firma no válida' }); return; }
  const datos = JSON.parse(req.body);
  console.log('Webhook:', datos);
  res.status(200).json({ ok: true });
});
*/

//GraphQL sobre los mismos modelos - de la doc de @apollo/server
/* npm i @apollo/server graphql
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const typeDefs = `type Query { eventos: [Evento], recinto(id: ID!): Recinto }
type Evento { id: ID, nombre: String, fecha: String, recinto: Recinto }
type Recinto { id: ID, nombre: String, localidad: String }`;
const resolvers = {
  Query: {
    eventos: () => Evento.find().lean(),
    recinto: (_, { id }) => Recinto.findById(id).lean()
  }
};
const apollo = new ApolloServer({ typeDefs, resolvers });
await apollo.start();
app.use('/graphql', expressMiddleware(apollo));
*/

/* =====================================================================
   G. TESTS
   ===================================================================== */

//Test de la API con node:test y supertest - de la doc de Node (node:test) y supertest
/* npm i --dev supertest
const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../index');   // index debe exportar app sin listen
test('GET /recintos devuelve lista', async () => {
  const r = await request(app).get('/recintos');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.data));
});
test('POST /recintos exige dirección larga', async () => {
  const r = await request(app).post('/recintos').send({ nombre: 'Sitio', direccion: 'corta', localidad: 'x' });
  assert.equal(r.status, 500);
});
*/

//Test con base de datos en memoria (no toca tu Atlas) - de la doc de mongodb-memory-server
/* npm i --dev mongodb-memory-server
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri());
// Al terminar: await mongoose.disconnect(); await mongod.stop();
*/

//Test con vitest - de la doc de vitest
/* npm i --dev vitest supertest
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
describe('recintos', () => {
  it('lista', async () => {
    const r = await request(app).get('/recintos');
    expect(r.status).toBe(200);
  });
});
// package.json: "test": "vitest run"
*/

//Smoke test con curl, sin framework - de la práctica de despliegue
/* # script de prueba (PowerShell)
curl.exe -s -o - -w "%{http_code}" http://localhost:3000/health
curl.exe -s -o - -w "%{http_code}" http://localhost:3000/recintos
*/

//Prueba de carga con k6 - de la doc de k6
/* // carga.js (k6)
import http from 'k6/http';
export const options = { vus: 20, duration: '30s' };
export default function () {
  const r = http.get('http://localhost:3000/eventos');
  if (r.status !== 200) throw new Error('status ' + r.status);
}
// k6 run carga.js
*/

/* =====================================================================
   H. DESPLIEGUE, CI Y HERRAMIENTAS
   ===================================================================== */

//Dockerfile para desplegar la API - de la doc de Docker y Node
/* # Dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "--env-file=.env", "index.js"]
# docker build -t api . && docker run -p 3000:3000 --env-file .env api
*/

//Dockerfile con imagen mínima y sin npm (para producción) - de la práctica de imágenes ligeras
/* FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
FROM node:24-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
CMD ["node", "index.js"]
*/

//docker-compose con MongoDB local - de la doc de Docker Compose
/* # docker-compose.yml
services:
  api:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [mongo]
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: [mongo_data:/data/db]
volumes:
  mongo_data:
# MONGODB_URI=mongodb://mongo:27017/despliegue
*/

//.dockerignore - de la práctica de Docker
/* node_modules
.env
.git
node_modules
npm-debug.log
Dockerfile
docker-compose.yml
*/

//Scripts de package.json para desarrollo y producción - de la doc de npm
/* "scripts": {
  "start": "node --env-file=.env index.js",
  "dev": "node --watch --env-file=.env index.js",
  "test": "node --test",
  "lint": "eslint .",
  "seed": "node seed.js",
  "backup": "mongodump --uri=$MONGODB_URI --out=backup"
}
*/

//CI con GitHub Actions: test en cada push - de la doc de GitHub Actions
/* # .github/workflows/ci.yml
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - run: npm test
*/

//ESLint con configuración plana - de la doc de ESLint
/* npm i --dev eslint
// eslint.config.js
module.exports = [
  { rules: { 'no-unused-vars': 'error', 'no-undef': 'error', 'no-multiple-empty-lines': ['error', { max: 2 }] } },
  { ignores: ['node_modules/**'] }
];
*/

//Prettier para formatear - de la doc de Prettier
/* npm i --dev prettier
// .prettierrc
{ "singleQuote": true, "semi": true, "printWidth": 100 }
// package.json: "format": "prettier --write ."
*/

//Husky: comprobar antes de hacer commit - de la doc de Husky
/* npm i --dev husky lint-staged
npx husky init
// .husky/pre-commit
npm run lint
// package.json: "lint-staged": { "*.js": "eslint --fix" }
*/

//Sentry para ver errores en producción - de la doc de Sentry
/* npm i @sentry/node
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.2 });
app.use(Sentry.middleware({}));
// En el middleware de errores: Sentry.captureException(err);
*/

//Backup con mongodump y mongorestore - de la doc de MongoDB
/* mongodump --uri="MONGODB_URI" --out=backup/
mongorestore --uri="MONGODB_URI" backup/
// Solo una colección:
mongodump --uri="MONGODB_URI" --collection=eventos --out=backup/
*/

//Seed: llenar la BD con datos de prueba - práctica de desarrollo
/* // seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const Recinto = require('./models/recinto');
const Evento = require('./models/evento');
await mongoose.connect(process.env.MONGODB_URI);
await Recinto.deleteMany({}); await Evento.deleteMany({});
const r = await Recinto.create({ nombre: 'Palacio de Deportes', direccion: 'Av. de la Paz 12', localidad: 'Madrid', aforoMaximo: '12000' });
await Evento.create({ nombre: 'Concierto de Rock en Vivo', fecha: new Date('2026-12-20'), recinto: r._id,
  entradas: [{ tipo: 'general', precio: 35, disponibles: 1000 }] });
await mongoose.disconnect();
console.log('Seed hecho');
*/

//Atlas Trigger: lanzar código cuando se inserta un evento - de la doc de MongoDB Atlas Triggers
/* En Atlas: Trigger de tipo Database, collection eventos, operation INSERT,
   con un Function que llama a la API o manda un email.
*/

//Atlas Search Index desde el código - de la doc de Atlas Search
/* const idx = await Recinto.collection.createSearchIndex({
  name: 'recintos',
  definition: { mappings: { dynamic: true } }
});
*/

//PM2 para mantener el proceso vivo - de la doc de PM2
/* npm i -g pm2
pm2 start index.js --name api --env-file=.env
pm2 monit
pm2 logs api
pm2 save && pm2 startup
// ecosystem.config.js:
module.exports = { apps: [{ name: 'api', script: 'index.js', instances: 'max', env_file: '.env', max_memory_restart: '200M' }] };
*/

//Procfile para Heroku/Render - de la doc de Render
/* // Procfile
web: node --env-file=.env index.js
*/

//Nginx como proxy inverso - de la doc de Nginx
/* # /etc/nginx/sites-available/api
server {
  listen 80;
  server_name api.midominio.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
  }
}
# Y en Express: app.set('trust proxy', 1)
*/

/* =====================================================================
   I. FUNCIONES DE NODE SIN LIBRERÍAS
   ===================================================================== */

//SQLite como base de datos local sin servidor - de la doc de Node (node:sqlite, Node 22+)
/* const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('eventos.db');
db.exec('CREATE TABLE IF NOT EXISTS eventos (id INTEGER PRIMARY KEY, nombre TEXT, fecha TEXT)');
const ins = db.prepare('INSERT INTO eventos (nombre, fecha) VALUES (?, ?)');
ins.run('Concierto', '2026-12-20');
const fila = db.prepare('SELECT * FROM eventos WHERE nombre LIKE ?').get('%rock%');
res.json({ ok: true, data: fila });
*/

//UUID para códigos de entrada - de la doc de Node (node:crypto)
/* const { randomUUID } = require('node:crypto');
const codigo = randomUUID();   // 'b1a9c8d2-...'
const corto = randomUUID().split('-')[0];
*/

//Comprimir un JSON en memoria - de la doc de Node (node:zlib)
/* const zlib = require('node:zlib');
const gzip = zlib.gzipSync(JSON.stringify(eventos));
res.set('Content-Encoding', 'gzip').type('application/json').send(gzip);
*/

//Leer la CPU y la memoria para el health check - de la doc de Node (node:os)
/* const os = require('node:os');
const carga = os.loadavg();
const cpus = os.cpus().length;
const libre = os.availableMemory();
const total = os.totalmem();
res.json({ ok: true, carga, cpus, memoriaLibreMB: Math.round(libre / 1048576), uso: (1 - libre / total).toFixed(2) });
*/

//Worker para no bloquear el servidor con trabajo pesado - de la doc de Node (node:worker_threads)
/* const { Worker, isMainThread, parentPort } = require('node:worker_threads');
if (isMainThread) {
  router.get('/informe', async (req, res) => {
    const w = new Worker(__filename);
    w.on('message', (informe) => res.json({ ok: true, data: informe }));
  });
} else {
  const datos = await Evento.find().lean();
  const informe = { total: datos.length, aforo: datos.reduce((s, e) => s + e.entradas.reduce((x, y) => x + y.disponibles, 0), 0) };
  parentPort.postMessage(informe);
}
*/

//Parsear argumentos de un script de línea de comandos - de la doc de Node (node:util parseArgs)
/* const { parseArgs } = require('node:util');
const { values } = parseArgs({
  options: { coleccion: { type: 'string' }, vaciar: { type: 'boolean' }, tamano: { type: 'string' } }
});
if (values.vaciar) await models[values.coleccion].deleteMany({});
*/

//Diagnóstico de la máquina en JSON - de la doc de Node (diagnostics_channel)
/* const { DiagnosticReport } = require('node:diagnostics_channel');
const r = new DiagnosticReport();
const informe = r.getReport();
res.json({ ok: true, uptime: informe.uptime, memoria: informe.memoryUsage, agentes: informe.jsVersion });
*/

//WebSocket cliente sin librería (Node 21+) - de la doc de Node (WebSocket global)
/* const c = new WebSocket('ws://localhost:3000');
c.onmessage = (e) => console.log('Recibido:', e.data);
*/

//Singleton executable: un solo fichero ejecutable - de la doc de Node (Single Executable Applications)
/* node --experimental-sea-config sea-config.json
node postject index.js nombre node sea-config.json
./index   // arranca sin node instalado
*/

//Permisos de fichero al ejecutar - de la doc de Node (--permission)
/* node --permission --allow-fs-read=./index.js --allow-fs-write=./logs --allow-child-process index.js
// El proceso no puede leer fuera de lo permitido.
*/

//Perfil de CPU para ver qué función tarda - de la doc de Node (--cpu-prof)
/* node --cpu-prof --cpu-prof-dir=prof index.js
// Se genera .cpuprofile que se abre con Chrome DevTools.
*/

//Advertencias y trazas al arrancar - de la doc de Node
/* node --trace-warnings index.js
node --max-old-space-size=512 index.js
node --expose-gc index.js
*/
