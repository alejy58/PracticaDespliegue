const express = require('express');
const router = express.Router();
const Evento = require('../models/evento');
const Recinto = require('../models/recinto');

router.get('/', async (req, res) => {
  try {
    const eventos = await Evento.find().populate('recinto');
    if(!eventos || eventos.length === 0) {
      return res.status(500).json({ok: false, error: 'No se encontraron eventos' });
    }
    return res.status(200).json({ok: true, data: eventos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message});
  }
});

router.get('/:id', async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if(!evento) {
      return res.status(404).json({ok: false, error: 'Evento no encontrado' });
    }
    return res.status(200).json({ok: true, data: evento });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message});
  }
});
router.get('/localidad/:nombre', async (req, res) => {
  try {
    const recintos = await Recinto.find({ localidad: req.params.nombre });
    if(!recintos || recintos.length === 0) {
      return res.status(500).json({ok: false, error: 'No se encontraron recintos en esa localidad' });
    }
    const eventos = await Evento.find({ recinto: { $in: recintos.map(r => r._id) } }).populate('recinto');
    if(!eventos || eventos.length === 0) {
      return res.status(500).json({ok: false, error: 'No se encontraron eventos en esa localidad' });
    }
    return res.status(200).json({ok: true, data: eventos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message});
  }
});

router.get('/entradas/:idEvento/:tipoEntrada', async (req, res) => {
  const{ idEvento, tipoEntrada } = req.params;
  try {
    const evento = await Evento.findById(idEvento);
    if(!evento) {
      return res.status(404).json({ok: false, error: `Error obteniendo datos de entrada para evento ${idEvento}` });
    }
    const entrada = evento.entradas.find(entrada => entrada.tipo === tipoEntrada);
    if(!entrada) {
      return res.status(404).json({ok: false, error: 'No se encontraron entradas de ese tipo para el evento' });
    }
    return res.status(200).json({ok: true, data: entrada });
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message});
  }
});

router.post('/', async (req, res) => {
  try {
    const evento = new Evento(req.body);
    await evento.save();
    return res.status(201).json({ok: true, resultado: evento });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message});
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const evento = await Evento.findByIdAndDelete(req.params.id);
    if(!evento) {
      return res.status(404).json({ok: false, error: 'Evento no encontrado' });
    }
    return res.status(200).json({ok: true, data: evento });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message});
  }
});

module.exports = router;