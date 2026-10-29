const Joi = require('joi');

const createSchema = Joi.object({
  candidateEmail: Joi.string().trim().lowercase().email().required(),
  title: Joi.string().trim().min(3).max(150).required(),
  scheduledAt: Joi.date().iso().greater('now').required(),
  durationMinutes: Joi.number().integer().min(15).max(240).default(60),
});

const updateSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150),
  scheduledAt: Joi.date().iso().greater('now'),
  durationMinutes: Joi.number().integer().min(15).max(240),
}).min(1);

const statusSchema = Joi.object({
  status: Joi.string().valid('in_progress', 'completed', 'cancelled').required(),
});

module.exports = { createSchema, updateSchema, statusSchema };