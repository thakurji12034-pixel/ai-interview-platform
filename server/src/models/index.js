const User = require('./User');
const Interview = require('./Interview');

User.hasMany(Interview, { as: 'interviewsGiven', foreignKey: 'interviewerId' });
User.hasMany(Interview, { as: 'interviewsTaken', foreignKey: 'candidateId' });
Interview.belongsTo(User, { as: 'interviewer', foreignKey: 'interviewerId' });
Interview.belongsTo(User, { as: 'candidate', foreignKey: 'candidateId' });

module.exports = { User, Interview };