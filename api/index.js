// Menggunakan fetch untuk memanggil API secara langsung.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("FATAL ERROR: Variabel lingkungan GEMINI_API_KEY belum diatur di Vercel!");
}

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

module.exports = async function handler(req, res) {
    // --- 1. Tangani CORS ---
    res.setHeader('Access-Control-Allow-Origin', 'https://khoira.biz.id'); // Ganti '*' dengan domain Anda jika sudah production
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { message, context: productsFromFrontend } = req.body;

        if (!message || !Array.isArray(productsFromFrontend)) {
            return res.status(400).json({ error: 'Pesan dan konteks produk wajib diisi.' });
        }

        // --- 2. [UPDATED] Prompt Baru yang Lebih Cerdas ---
        const prompt = `
            Anda adalah seorang asisten belanja AI yang sangat ramah, cerdas, dan atraktif untuk website katalog afiliasi.
            Tugas Anda adalah memberikan rekomendasi produk yang meyakinkan dari daftar yang diberikan.

            PERINTAH PENTING:
            1.  Mulai dengan kalimat pembuka yang ramah dan bersahabat.
            2.  Analisis pertanyaan pengguna dan daftar produk yang tersedia.
            3.  Jika ada produk yang relevan, jelaskan mengapa produk itu cocok. KATEGORIKAN jawaban Anda jika memungkinkan untuk memberikan pilihan yang lebih jelas kepada pengguna (Contoh: "untuk santai" vs "untuk aktivitas berat").
            4.  Sebutkan nama produk yang direkomendasikan dengan **TEPAT** seperti yang ada di dalam daftar.
            5.  Gunakan format **Markdown** untuk membuat jawaban Anda mudah dibaca (gunakan **teks tebal** untuk penekanan dan tanda bintang \`*\` atau tanda hubung \`-\` untuk daftar berpoin).
            6.  Jika tidak ada produk yang cocok, berikan jawaban yang sopan bahwa produk tidak ditemukan dan mungkin tawarkan alternatif.
            
            Daftar Produk yang Tersedia (JSON):
            ${JSON.stringify(productsFromFrontend.map(p => ({ name: p.name, category: p.category, description: p.description })))}

            Pertanyaan dari Pengguna: "${message}"

            Jawaban Anda (dalam format Markdown):
        `;

        // --- 3. Panggil Gemini API ---
        const geminiResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            throw new Error(`Gemini API Error: ${errorData.error ? errorData.error.message : geminiResponse.statusText}`);
        }

        const data = await geminiResponse.json();
        
        // --- 4. Proses dan Kirim Jawaban Teks ---
        if (data.candidates && data.candidates.length > 0) {
            const botMessage = data.candidates[0].content.parts[0].text;
            // Langsung kirim balasan teks dari AI, tidak perlu parsing JSON lagi di sini.
            return res.status(200).json({ reply: botMessage });
        } else {
             return res.status(200).json({ reply: "Maaf, sepertinya saya sedang tidak bisa memberikan rekomendasi saat ini." });
        }

    } catch (error) {
        console.error('FATAL ERROR in Vercel Function:', error);
        return res.status(500).json({ error: `An unexpected server error occurred: ${error.message}` });
    }
};
