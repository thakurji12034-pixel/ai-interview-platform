const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_PATH = '/api/auth';

const cookieOptions = {
  httpOnly: true, // JavaScript se cookie padhi nahi ja sakti (XSS se bachav)
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: COOKIE_PATH,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const signAccessToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });

const signRefreshToken = (user) =>
  jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// Naye access + refresh token banata hai, refresh token ka hash DB me rakhta hai
const issueTokens = async (user, res) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  user.refreshToken = hashToken(refreshToken);
  await user.save();

  res.cookie('refreshToken', refreshToken, cookieOptions);
  return accessToken;
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role });

    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));

    // Dono case me same message, taaki attacker ko pata na chale kaunsi email registered hai
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const accessToken = await issueTokens(user, res);
    res.json({ accessToken, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'Refresh token missing' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await User.findByPk(payload.id);
    if (!user || user.refreshToken !== hashToken(token)) {
      return res.status(401).json({ message: 'Refresh token is no longer valid' });
    }

    // Rotation: har refresh par naya refresh token, purana bekar ho jata hai
    const accessToken = await issueTokens(user, res);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        await User.update({ refreshToken: null }, { where: { id: payload.id } });
      } catch (err) {
        // token pehle se invalid hai, cookie hatana kaafi hai
      }
    }

    res.clearCookie('refreshToken', { path: COOKIE_PATH });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};