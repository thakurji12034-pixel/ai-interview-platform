const { Op } = require('sequelize');
const { User, Interview } = require('../models');
const { TRANSITIONS, addMinutes, findClash } = require('../services/interviewService');

const withUsers = [
  { model: User, as: 'interviewer', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'candidate', attributes: ['id', 'name', 'email'] },
];

// Sirf wahi interview milegi jisme user participant hai.
// Doosre ke liye 404 dete hain, taaki pata na chale ki interview exist karti hai.
const findMine = (id, userId) =>
  Interview.findOne({
    where: {
      id,
      [Op.or]: [{ interviewerId: userId }, { candidateId: userId }],
    },
    include: withUsers,
  });

exports.create = async (req, res, next) => {
  try {
    const { candidateEmail, title, scheduledAt, durationMinutes } = req.body;

    const candidate = await User.findOne({
      where: { email: candidateEmail, role: 'candidate' },
    });
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const endAt = addMinutes(scheduledAt, durationMinutes);
    const clash = await findClash({
      userIds: [req.user.id, candidate.id],
      start: scheduledAt,
      end: endAt,
    });
    if (clash) {
      return res.status(409).json({ message: 'Time slot clashes with another interview' });
    }

    const interview = await Interview.create({
      interviewerId: req.user.id,
      candidateId: candidate.id,
      title,
      scheduledAt,
      durationMinutes,
      endAt,
    });

    res.status(201).json({ interview });
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const where =
      req.user.role === 'interviewer'
        ? { interviewerId: req.user.id }
        : { candidateId: req.user.id };

    const { status } = req.query;
    if (status && Object.keys(TRANSITIONS).includes(status)) {
      where.status = status;
    }

    const interviews = await Interview.findAll({
      where,
      order: [['scheduledAt', 'ASC']],
      include: withUsers,
    });
    res.json({ interviews });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const interview = await findMine(req.params.id, req.user.id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    res.json({ interview });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const interview = await findMine(req.params.id, req.user.id);
    if (!interview || interview.interviewerId !== req.user.id) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    if (interview.status !== 'scheduled') {
      return res.status(409).json({ message: 'Only scheduled interviews can be edited' });
    }

    const title = req.body.title ?? interview.title;
    const scheduledAt = req.body.scheduledAt ?? interview.scheduledAt;
    const durationMinutes = req.body.durationMinutes ?? interview.durationMinutes;
    const endAt = addMinutes(scheduledAt, durationMinutes);

    const clash = await findClash({
      userIds: [interview.interviewerId, interview.candidateId],
      start: scheduledAt,
      end: endAt,
      excludeId: interview.id, // khud se clash nahi gina jayega
    });
    if (clash) {
      return res.status(409).json({ message: 'Time slot clashes with another interview' });
    }

    await interview.update({ title, scheduledAt, durationMinutes, endAt });
    res.json({ interview });
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const interview = await findMine(req.params.id, req.user.id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Candidate sirf cancel kar sakta hai, start/complete interviewer karega
    const isInterviewer = interview.interviewerId === req.user.id;
    if (!isInterviewer && status !== 'cancelled') {
      return res.status(403).json({ message: 'Only the interviewer can do this' });
    }

    if (!TRANSITIONS[interview.status].includes(status)) {
      return res.status(409).json({
        message: `Cannot change status from ${interview.status} to ${status}`,
      });
    }

    await interview.update({ status });
    res.json({ interview });
  } catch (err) {
    next(err);
  }
};