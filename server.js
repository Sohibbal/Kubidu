const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();

const QuizResult = require('./models/QuizResult');
const PretestResult = require('./models/PretestResult');
const Admin = require('./models/Admin');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quiz_system';
const SESSION_SECRET = process.env.SESSION_SECRET || 'rahasia_kuis_sohibbal';

// ----------------------------------------------------
// KONFIGURASI APLIKASI
// ----------------------------------------------------

// Koneksi Database
mongoose.connect(DB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ DB connection error:', err));

// Admin User Seeder (Hanya dijalankan sekali untuk membuat user admin)
async function seedAdmin() {
    try {
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (!adminExists) {
            const newAdmin = new Admin({
                username: 'admin',
                password: 'password123' // Ubah ke password yang lebih kuat di produksi!
            });
            await newAdmin.save();
            console.log('Admin user seeded: admin/password123');
        }
    } catch (error) {
        console.error('Error seeding admin:', error);
    }
}
seedAdmin();

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true })); // Untuk parsing form data
app.use(express.json());
app.use(express.static('public')); // File statis
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 jam
}));

// Middleware untuk cek otentikasi admin
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
}

// ----------------------------------------------------
// DATA SOAL & JAWABAN
// ----------------------------------------------------

const QUESTIONS = [
    { id: 1, text: '"Mereka saling bertukar cerita tentang pakaian adat masing-masing". Hal yang dilakukan mereka termasuk bentuk cara melestarikan keberagaman budaya secara umum yang mana?', options: { A: 'Meningkatkan toleransi antar sesama', B: 'Menghormati budaya orang lain', C: 'Memakan pakaian Melayu Riau di acara penting', D: 'Mengenalkan budaya ke orang lain' } },
    { id: 2, text: 'Apa manfaat memakai pakaian adat di sekolah?', options: { A: 'Melestarikan keberagaman budaya', B: 'Ajang pamer', C: 'Mempercantik diri', D: 'Agar bisa memaksa orang lain' } },
    { id: 3, text: 'Salah satu cara melestarikan keberagaman budaya secara umum, kecuali?', options: { A: 'Mengikuti kegiatan budaya', B: 'Menambah penghasilan', C: 'Mengenalkan budaya ke orang lain', D: 'Menghormati budaya orang lain' } },
    { id: 4, text: 'Kamu punya teman dari daerah lain yang memakai pakaian adatnya. Apa sikap yang paling baik?', options: { A: 'Mengejek supaya dia malu', B: 'Diam saja dan tidak peduli', C: 'Menghargai dan memuji karena budayanya indah', D: 'Menyuruhnya ganti dengan baju modern' } },
    { id: 5, text: 'Mengapa keberagaman budaya perlu diwariskan ke generasi muda?', options: { A: 'Supaya budaya Indonesia tetap terjaga dan tidak hilang', B: 'Supaya hanya orang tua yang mengenalnya', C: 'Supaya budaya asing lebih banyak masuk', D: 'Supaya anak-anak tidak mau belajar budaya' } },
    { id: 6, text: 'Andi melihat ada pertunjukkan tari daerah di alun-alun. Temannnya paling malas nonton karena menurutnya itu kuno. Apa yang sebaiknyaaa Andi lakukan agar budaya tetap terjaga?', options: { A: 'Ikut menertawakan tarian itu', B: 'Mengajak temannya untuk menonton dan menghargai tarian daerah', C: 'Pulang saja karena acaranya membosankan', D: 'Meminta pertunjukkan diganti dengan konser modern' } },
    { id: 7, text: 'Di sekolah, guru meminta murid mengenalkan budaya daerahnya. Siti bingung mau pilih cara yang mana. Menurut Ananda, cara mana yang paling baik untuk menjaga budaya tetap dikenal?', options: { A: 'Menceritakan budaya lewat gambar, lagu, atau video sederhana', B: 'Diam saja agar tidak salah bicara', C: 'Meniru budaya negara lain', D: 'Membiarkan budaya dilupakan karena sudah tua' } },
    { id: 8, text: 'Saat lomba, Beni memakai baju derah Melayu Riau. Ada teman yang menertawakan. Jika kamu jadi Beni, apa yang harus dilakukan untuk melestarikan budaya?', options: { A: 'Melepas baju adat lalu ganti baju kaos modern', B: 'Tetap memakai baju daerah Melayu Riau dengan bangga', C: 'Ikut menertawakan dirinya sendiri', D: 'Tidak ikut lomba supaya tidak malu' } },
    { id: 9, text: 'Lina ingin menjaga budaya daerahnya agar tidak hilang. Menurutmu, tindakan apa yang paling tepat?', options: { A: 'Mengikuti acara budaya di sekolah atau lingkungan sekitar', B: 'Membiarkan orang lain menjaga budaya sendiri', C: 'Hanya belajar budaya lewat internet tanpa ikut serta', D: 'Menyembunyikan budayanya supaya tidak diketahui orang lain' } },
    { id: 10, text: 'Di rumah, Raka suka mendengar cerita kakeknya tentang budaya daerah. Apa yang bisa dilakukan Raka supaya budaya itu tetap dikenal orang lain?', options: { A: 'Menyimpan cerita itu sendiri saja', B: 'Menceritakan kembali ke teman', C: 'Melupakan karena sudah kuno', D: 'Menutup-nutupi supaya tidak diketahui' } },
];

const CORRECT_ANSWERS = {
    1: "D", 2: "A", 3: "B", 4: "C", 5: "A",
    6: "B", 7: "A", 8: "B", 9: "A", 10: "B"
};

// Fungsi untuk mengacak array (Fisher-Yates Shuffle)
function shuffleArray(array) {
    let newArray = [...array]; // Buat salinan array agar yang asli (QUESTIONS) tidak berubah
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// ----------------------------------------------------
// RUTE UNTUK SISWA (KUIS & PRETEST)
// ----------------------------------------------------

// Rute Awal: Input Nama Siswa
app.get('/', (req, res) => {
    // Menghapus studentName dari session agar user baru bisa memulai
    delete req.session.studentName; 
    res.render('landing');
});

app.get('/pretestquiz', (req, res) => {
    // Menghapus studentName dari session agar user baru bisa memulai
    delete req.session.studentName; 
    res.render('index');
});

// server.js (di rute POST /start)

app.post('/start', (req, res) => {
    const { studentName, examType } = req.body;
    if (!studentName || !examType) {
        return res.redirect('/pembelajaran');
    }
    req.session.studentName = studentName;

    if (examType === 'quiz') {
        req.session.currentQuizQId = 1; 
        req.session.quizAnswers = {}; // Reset jawaban Quiz
        res.redirect('/quiz');
    } else if (examType === 'pretest') {
        // PERUBAHAN UTAMA: Tambahkan session untuk Pretest per soal
        req.session.currentPretestQId = 1; // Mulai dari soal 1
        req.session.pretestAnswers = {}; // Reset jawaban Pretest
        // 🎯 PERUBAHAN UTAMA: ACak Soal dan Simpan Urutan ke Session
        const shuffledQuestions = shuffleArray(QUESTIONS);
        req.session.pretestQuestions = shuffledQuestions;
        res.redirect('/pretest'); // Arahkan ke rute /pretest yang baru
    } else {
        res.redirect('/pembelajaran');
    }
});


// --- KUIS (Per Soal) ---

app.get('/pembelajaran', (req, res) => {
    const studentName = req.session.studentName;

    // if (!studentName) return res.redirect('/');
    
    // Hapus variabel session quiz lama
    delete req.session.currentQuizQId;
    delete req.session.quizAnswers;

    // Render template quiz.ejs dan kirimkan SEMUA data soal
    res.render('pembelajaran', {
        studentName,
        questions: QUESTIONS, // Kirim array soal lengkap
        totalQuestions: QUESTIONS.length
    });
});

app.get('/pembelajaran2', (req, res) => {
    const studentName = req.session.studentName;

    // if (!studentName) return res.redirect('/');
    
    // Hapus variabel session quiz lama
    delete req.session.currentQuizQId;
    delete req.session.quizAnswers;

    // Render template quiz.ejs dan kirimkan SEMUA data soal
    res.render('pembelajaran2', {
        studentName,
        questions: QUESTIONS, // Kirim array soal lengkap
        totalQuestions: QUESTIONS.length
    });
});

app.post('/submit-final-quiz', async (req, res) => {
    // 🎯 BARU: Menerima data JSON dari script.js
    const { studentName, answers } = req.body; 
    
    if (!studentName || !answers) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });
    }

    const finalResult = { studentName };
    let totalCorrect = 0;
    
    try {
        // Hitung Skor dan Tentukan Benar/Salah
        for (let i = 1; i <= QUESTIONS.length; i++) {
            const questionId = `q${i}`; // q1, q2, ...
            const studentAns = answers[questionId]; // Jawaban siswa (misal: 'C')
            const correctAns = CORRECT_ANSWERS[i]; // Kunci jawaban dari server

            const isCorrect = studentAns === correctAns;

            finalResult[`q${i}_correct`] = isCorrect;
            if (isCorrect) totalCorrect++;
        }

        finalResult.totalScore = totalCorrect * 10; 
        
        // Simpan ke Database (sesuai model QuizResult Anda)
        const newResult = new QuizResult(finalResult);
        await newResult.save();
        
        // Kirim balik skor final ke JavaScript untuk ditampilkan
        res.json({ success: true, score: finalResult.totalScore, totalCorrect });

    } catch (error) {
        console.error('Error saving final Quiz Result:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan hasil.' });
    }
});

// app.get('/quiz', (req, res) => {
//     const studentName = req.session.studentName;
//     const currentQId = req.session.currentQuizQId;

//     if (!studentName) return res.redirect('/');
//     if (currentQId > QUESTIONS.length) {
//         // Jika sudah selesai
//         return res.render('result', {
//             studentName,
//             isFinished: true,
//             totalQuestions: QUESTIONS.length,
//             results: req.session.quizAnswers // Hasil total untuk ditunjukkan di akhir
//         });
//     }

//     const currentQuestion = QUESTIONS.find(q => q.id === currentQId);
//     if (!currentQuestion) return res.redirect('/'); // Error, kembali ke awal

//     res.render('quiz', {
//         studentName,
//         question: currentQuestion,
//         totalQuestions: QUESTIONS.length
//     });
// });

// app.post('/quiz/submit-answer', async (req, res) => {
//     const { questionId, studentAnswer } = req.body;
//     const studentName = req.session.studentName;
//     const currentQId = parseInt(questionId);

//     if (!studentName || !studentAnswer || currentQId !== req.session.currentQuizQId) {
//         // Validasi dasar
//         return res.redirect('/quiz');
//     }

//     const correctAnswer = CORRECT_ANSWERS[currentQId];
//     const isCorrect = studentAnswer === correctAnswer;

//     // Simpan hasil untuk review di akhir
//     req.session.quizAnswers[currentQId] = {
//         questionId: currentQId,
//         studentAnswer,
//         correctAnswer,
//         isCorrect
//     };

//     // Pindah ke soal berikutnya
//     req.session.currentQuizQId++;

//     // Tampilkan notifikasi
//     res.render('result', {
//         studentName,
//         isFinished: false,
//         isCorrect,
//         correctAnswer,
//         nextQId: req.session.currentQuizQId
//     });

//     // Jika sudah soal terakhir, simpan ke database
//     if (req.session.currentQuizQId > QUESTIONS.length) {
//         try {
//             const finalResult = { studentName };
//             let totalCorrect = 0;
            
//             for (let i = 1; i <= QUESTIONS.length; i++) {
//                 const qResult = req.session.quizAnswers[i];
//                 if (qResult) {
//                     finalResult[`q${i}_correct`] = qResult.isCorrect;
//                     if (qResult.isCorrect) totalCorrect++;
//                 }
//             }

//             finalResult.totalScore = totalCorrect * 10; 
        
//             const newResult = new QuizResult(finalResult);
//             await newResult.save();
//             console.log(`Quiz Result saved for ${studentName}. Score: ${finalResult.totalScore}/100`);

//         } catch (error) {
//             console.error('Error saving Quiz Result:', error);
//         }
//     }
// });

// --- PRETEST (Semua Soal di Satu Halaman) ---

// server.js (Rute baru untuk Pretest per soal)

app.get('/pretest', (req, res) => {
    const studentName = req.session.studentName;
    const currentQId = req.session.currentPretestQId;

    if (!studentName) return res.redirect('/');
    
    // 🎯 PERUBAHAN 1: Ambil daftar soal dari session (yang sudah teracak)
    const shuffledQuestions = req.session.pretestQuestions;

    if (!shuffledQuestions || currentQId > QUESTIONS.length) {
         // Jika sudah selesai atau session hilang
        return res.redirect('/pretest/score');
    }
    
    // 🎯 PERUBAHAN 2: Ambil soal saat ini berdasarkan INDEKS (currentQId - 1)
    // Karena kita bekerja dengan array acak, kita ambil berdasarkan indeks array (0-9)
    const currentQuestion = shuffledQuestions[currentQId - 1]; 
    if (!currentQuestion) return res.redirect('/');

    res.render('pretest_question', {
        studentName,
        question: currentQuestion,
        totalQuestions: QUESTIONS.length,
        currentStep: currentQId
    });
});

// server.js (Rute baru untuk submit jawaban Pretest)

app.post('/pretest/submit-answer', (req, res) => {
    const { questionId, studentAnswer } = req.body;
    const studentName = req.session.studentName;
    const currentQId = req.session.currentPretestQId;

    if (!studentName || !studentAnswer || currentQId !== req.session.currentPretestQId) {
        return res.redirect('/pretest');
    }

// 🎯 PERUBAHAN UTAMA: Gunakan questionId sebagai Kunci Penyimpanan
    // questionId adalah ID soal asli (1-10), BUKAN urutan array.
    req.session.pretestAnswers[questionId] = studentAnswer; 

    // 2. Pindah ke array index berikutnya
    req.session.currentPretestQId++;

    // 3. Jika ini adalah soal terakhir, arahkan ke halaman skor
    if (req.session.currentPretestQId > QUESTIONS.length) {
        return res.redirect('/pretest/score');
    }

    // 4. Jika belum selesai, lanjut ke soal berikutnya
    res.redirect('/pretest'); 
});

// server.js (Rute GET untuk menghitung skor Pretest)

app.get('/pretest/score', async (req, res) => {
    const studentName = req.session.studentName;
    const studentAnswers = req.session.pretestAnswers;
    if (!studentName || !studentAnswers) return res.redirect('/pembelajaran');

    const finalResult = { studentName };
    let totalCorrect = 0;

// 🎯 PERUBAHAN UTAMA: Loop melalui ID soal asli (1-10)
    for (let i = 1; i <= QUESTIONS.length; i++) {
        const studentAns = studentAnswers[i]; // Ambil jawaban siswa berdasarkan ID soal (i)
        const correctAns = CORRECT_ANSWERS[i];
        
        // Hanya cek jika siswa menjawab soal ini (walaupun soalnya diacak)
        if (studentAns) { 
            const isCorrect = studentAns === correctAns;
            finalResult[`q${i}_correct`] = isCorrect;
            if (isCorrect) totalCorrect++;
        } else {
             finalResult[`q${i}_correct`] = false; // Jika tidak dijawab
        }
    }

    const score = totalCorrect * 10;
    finalResult.totalScore = score;
    
    try {
        // HANYA SIMPAN KE DATABASE SEKALI setelah semua soal selesai
        const newResult = new PretestResult(finalResult);
        await newResult.save();
        console.log(`Pretest Result saved for ${studentName}. Score: ${score}`);

        // Bersihkan session
        delete req.session.pretestAnswers;
        delete req.session.currentPretestQId;

        // Render halaman skor akhir
        res.render('pretest_score', { studentName, score, totalCorrect });

    } catch (error) {
        console.error('Error saving Pretest Result:', error);
        res.status(500).send('Error saving pretest result');
    }
});

app.get('/home', (req, res) => {
    // Merender file views/home.ejs tanpa perlu mengirim data dinamis
    res.render('home'); 
});

app.get('/cerita', (req, res) => {
    // Merender file views/home.ejs tanpa perlu mengirim data dinamis
    res.render('cerita'); 
});

app.get('/video', (req, res) => {
    // Merender file views/home.ejs tanpa perlu mengirim data dinamis
    res.render('video'); 
});

app.get('/games', (req, res) => {
    // Merender file views/home.ejs tanpa perlu mengirim data dinamis
    res.render('games'); 
});

// ----------------------------------------------------
// RUTE UNTUK ADMIN (DASHBOARD)
// ----------------------------------------------------

// Rute Login
app.get('/admin/login', (req, res) => {
    res.render('admin_login', { error: req.session.loginError });
    delete req.session.loginError; // Bersihkan error
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (admin && await admin.comparePassword(password)) {
            req.session.isAdmin = true;
            res.redirect('/admin/dashboard');
        } else {
            req.session.loginError = 'Username atau Password salah';
            res.redirect('/admin/login');
        }
    } catch (error) {
        console.error(error);
        req.session.loginError = 'Terjadi kesalahan server.';
        res.redirect('/admin/login');
    }
});

// Rute Logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/');
    });
});

// Rute Dashboard
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
    try {
        // Ambil semua hasil dari database
        const quizResults = await QuizResult.find().sort({ submittedAt: 1 }).lean();
        const pretestResults = await PretestResult.find().sort({ submittedAt: 1 }).lean();
        
        // Buat header dinamis
        const quizHeaders = ['Nama Siswa', ...QUESTIONS.map(q => `Soal ${q.id}`), 'Skor', 'Waktu Submit'];
        const pretestHeaders = ['Nama Siswa', ...QUESTIONS.map(q => `Soal ${q.id}`), 'Skor', 'Waktu Submit'];

        res.render('dashboard', {
            quizResults,
            pretestResults,
            quizHeaders,
            pretestHeaders
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading dashboard data');
    }
});

// Rute Export ke Excel (CSV sederhana)
const ExcelJS = require('exceljs');

app.get('/admin/export/:type', requireAdmin, async (req, res) => {
    const { type } = req.params;
    let data;
    let filename;

    try {
        if (type === 'quiz') {
            data = await QuizResult.find().sort({ submittedAt: 1 }).lean();
            filename = 'quiz_results.xlsx';
        } else if (type === 'pretest') {
            data = await PretestResult.find().sort({ submittedAt: 1 }).lean();
            filename = 'pretest_results.xlsx';
        } else {
            return res.status(400).send('Invalid export type');
        }

        // 🔹 Buat workbook & worksheet baru
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Results');

        // 🔹 Header kolom
        const headers = [
            { header: 'Nama Siswa', key: 'studentName', width: 25 },
            ...Array.from({ length: 10 }, (_, i) => ({
                header: `Soal ${i + 1}`,
                key: `q${i + 1}_correct`,
                width: 15
            })),
            { header: 'Skor', key: 'totalScore', width: 10 },
            { header: 'Waktu Submit', key: 'submittedAt', width: 25 }
        ];

        worksheet.columns = headers;

        // 🔹 Isi data ke baris Excel
        data.forEach(item => {
            const row = {
                studentName: item.studentName,
                totalScore: item.totalScore || (Object.values(item).filter(v => v === true).length * 10),
                submittedAt: item.submittedAt
                    ? new Date(item.submittedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
                    : '-'
            };

            // Isi tiap kolom soal (Benar/Salah)
            for (let i = 1; i <= 10; i++) {
                row[`q${i}_correct`] = item[`q${i}_correct`] ? 'Benar' : 'Salah';
            }

            worksheet.addRow(row);
        });

        // 🔹 Styling header (opsional biar rapi)
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { horizontal: 'center' };
        worksheet.columns.forEach(col => {
            col.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // 🔹 Set response untuk download
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        // 🔹 Kirim file langsung tanpa simpan di server
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).send('Error exporting Excel');
    }
});


// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Admin Dashboard: http://localhost:${PORT}/admin/login`);
});