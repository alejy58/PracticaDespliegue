require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const recintosRouter = require('./routes/recintos');
const eventosRouter = require('./routes/eventos');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json());

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