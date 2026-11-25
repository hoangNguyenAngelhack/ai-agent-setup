const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]);

function profileHtml(user) {
  return `<article class="profile"><h1>${escapeHtml(user.name)}</h1><p>${escapeHtml(user.email)}</p></article>`;
}

module.exports = { profileHtml };
