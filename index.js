require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const recintosRouter = require('./routes/recintos');
const eventosRouter = require('./routes/eventos');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json());

// Cabeceras CORS: permiten que el front (o cualquier origen) llame a la API
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/recintos', recintosRouter);
app.use('/eventos', eventosRouter);

mongoose.connect(MONGODB_URI)
  .then(()=>{
    console.log('Conectado a MongoDB');
    app.listen(PORT,()=>{
      console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });
  }).catch((error)=>{
    console.error('Error en la conexion: ',error);
  });