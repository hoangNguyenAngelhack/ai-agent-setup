const users = [
  { id: 1, name: 'Ada', email: 'ada@example.com', role: 'admin' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Cy', email: 'cy@example.com', role: 'user' },
];

const orders = Array.from({ length: 45 }, (_, index) => ({
  id: index + 1,
  userId: (index % 3) + 1,
  total: (index + 1) * 10,
  status: index % 4 === 0 ? 'shipped' : 'pending',
}));

const tokens = { 'token-ada': 1, 'token-bob': 2, 'token-cy': 3 };

function findUser(id) {
  return users.find((user) => user.id === id);
}

function findUserByEmail(email) {
  return users.find((user) => user.email === email);
}

function findOrder(id) {
  return orders.find((order) => order.id === id);
}

function ordersOf(userId) {
  return orders.filter((order) => order.userId === userId);
}

function addUser({ name, email }) {
  const user = { id: Math.max(...users.map((existing) => existing.id)) + 1, name, email, role: 'user' };
  users.push(user);
  return user;
}

module.exports = { users, orders, tokens, findUser, findUserByEmail, findOrder, ordersOf, addUser };
