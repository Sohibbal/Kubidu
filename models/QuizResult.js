const mongoose = require('mongoose');

const QuizResultSchema = new mongoose.Schema({
    studentName: { type: String, required: true },
    // Kolom untuk indikasi jawaban Benar (true) atau Salah (false) per soal
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
    totalScore: { type: Number, required: true, default: 0 },
    // Waktu submit
    submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('QuizResult', QuizResultSchema);