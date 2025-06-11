// Memanggil API secara langsung menggunakan fetch.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("FATAL ERROR: Variabel lingkungan GEMINI_API_KEY belum diatur di Vercel!");
}

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

module.exports = async function handler(req, res) {
    // --- 1. Tangani CORS ---
    res.setHeader('Access-Control-Allow-Origin', '*'); // Ganti '*' dengan domain Anda jika sudah production
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

        // --- 2. [UPDATED] Prompt Baru yang Lebih Canggih ---
        const prompt = `
            Anda adalah AI asisten belanja yang sangat ramah dan membantu. Tugas Anda adalah memberikan rekomendasi produk dari daftar yang diberikan.
            Balas HANYA dengan format JSON. JSON harus memiliki dua properti:
            1.  "reply_text": sebuah string berisi kalimat pembuka yang ramah dan atraktif. Di dalam kalimat ini, sebutkan nama produk yang direkomendasikan dengan **teks tebal (Markdown)**. Jika relevan, kategorikan rekomendasimu. Contoh: "Tentu! Untuk gaya kasual, ada **Sandal Gunung Boehajj** yang keren. Tapi kalau untuk aktivitas lebih berat, **TVF Footwear Sandals** lebih cocok."
            2.  "recommended_products": sebuah array berisi NAMA-NAMA produk yang Anda sebutkan di reply_text.

            Contoh format balasan yang DIHARAPKAN: 
            {"reply_text": "Tentu! Aku punya beberapa jenis sandal gunung nih: \\n- **Untuk Santai:** ada **Sandal Gunung Boehajj** yang desainnya kasual. \\n- **Untuk Aktivitas Berat:** ada **TVF Footwear Sandals** yang lebih kokoh.", "recommended_products": ["Sandal Gunung Boehajj", "TVF Footwear Sandals"]}
            
            Jika tidak ada produk yang cocok, kembalikan array "recommended_products" yang kosong dan berikan penjelasan di "reply_text".
            Jika pertanyaannya di luar konteks produk, berikan jawaban di "reply_text" dan biarkan "recommended_products" kosong.
            
            Daftar Produk yang Tersedia:
            ${JSON.stringify(productsFromFrontend.map(p => ({ name: p.name, category: p.category, description: p.description })))}

            Pertanyaan Pengguna: "${message}"
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
        
        // --- 4. Proses dan Kirim Jawaban ---
        if (data.candidates && data.candidates.length > 0) {
            let rawTextResponse = data.candidates[0].content.parts[0].text;
            
            const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
            const match = rawTextResponse.match(jsonRegex);
            if (match && match[1]) {
                rawTextResponse = match[1];
            }

            try {
                const parsedJson = JSON.parse(rawTextResponse);
                const replyText = parsedJson.reply_text || "Berikut adalah rekomendasi untukmu:";
                const recommendedNames = parsedJson.recommended_products || [];

                if (recommendedNames.length > 0) {
                    const recommendedProducts = productsFromFrontend.filter(p => recommendedNames.includes(p.name));
                    return res.status(200).json({ reply: replyText, products: recommendedProducts });
                } else {
                    return res.status(200).json({ reply: replyText });
                }
            } catch (e) {
                console.error("Gagal mem-parsing JSON dari AI:", rawTextResponse);
                return res.status(200).json({ reply: "Maaf, saya mendapat jawaban yang tidak terduga dari AI. Coba lagi ya." });
            }
        } else {
             return res.status(200).json({ reply: "Maaf, saya tidak bisa memberikan rekomendasi saat ini." });
        }

    } catch (error) {
        console.error('FATAL ERROR in Vercel Function:', error);
        return res.status(500).json({ error: `An unexpected server error occurred: ${error.message}` });
    }
};
