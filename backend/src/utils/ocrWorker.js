const Tesseract = require('tesseract.js');

process.on('message', async (filePath) => {
    try {
        const worker = await Tesseract.createWorker('eng');
        const { data: { text } } = await worker.recognize(filePath);
        await worker.terminate();
        process.send({ success: true, text });
    } catch (error) {
        process.send({ success: false, error: error.message });
    }
});
