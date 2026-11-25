const express = require('express');
const router = express.Router();
const Recinto = require('../models/recinto');

router.get('/', async (req, res) => {
  try {
    const recintos = await Recinto.find();
    if(!recintos || recintos.length === 0) {
      return res.status(500).json({ok: false, message: 'No se encontraron recintos' });
    }
    return res.status(200).json({ok: true, data: recintos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const recinto = await Recinto.findById(req.params.id);
    if(!recinto) {
      return res.status(404).json({ok: false, message: 'Recinto no encontrado' });
    }
    return res.status(200).json({ok: true, data: recinto });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/localidad/:nombre', async (req, res) => {
  try {
    const recintos = await Recinto.find({ localidad: req.params.nombre });
    if(!recintos || recintos.length === 0) {
      return res.status(500).json({ok: false, message: 'No se encontraron recintos en esa localidad' });
    }
    return res.status(200).json({ok: true, data: recintos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post('/', async (req, res) => {
  try {
    const recinto = new Recinto(req.body);
    await recinto.save();
    return res.status(201).json({ok: true, data: recinto });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const recinto = await Recinto.findByIdAndDelete(req.params.id);
    if(!recinto) {
      return res.status(404).json({ok: false, message: 'Recinto no encontrado' });
    }
    return res.status(200).json({ok: true, data: recinto });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;