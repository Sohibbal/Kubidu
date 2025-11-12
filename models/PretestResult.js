const mongoose = require('mongoose');

const PretestResultSchema = new mongoose.Schema({
    studentName: { type: String, required: true },
    q1_correct: { type: Boolean, default: false },
    q2_correct: { type: Boolean, default: false },
    q3_correct: { type: Boolean, default: false },
    q4_correct: { type: Boolean, default: false },
    q5_correct: { type: Boolean, default: false },
    q6_correct: { type: Boolean, default: false },
    q7_correct: { type: Boolean, default: false },
    q8_correct: { type: Boolean, default: false },
    q9_correct: { type: Boolean, default: false },
    q10_correct: { type: Boolean, default: false },
    totalScore: { type: Number, required: true, default: 0 }, // Tambahan skor total
    submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PretestResult', PretestResultSchema);