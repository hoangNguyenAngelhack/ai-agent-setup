function profileHtml(user) {
  return `<article class="profile"><h1>${user.name}</h1><p>${user.email}</p></article>`;
}

module.exports = { profileHtml };
