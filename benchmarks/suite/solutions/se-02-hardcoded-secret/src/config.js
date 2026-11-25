const SIGNING_SECRET = process.env.SIGNING_SECRET;
if (!SIGNING_SECRET) throw new Error('SIGNING_SECRET is not set');

module.exports = { SIGNING_SECRET, PORT: 3000 };
