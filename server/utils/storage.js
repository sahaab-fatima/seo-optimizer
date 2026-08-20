const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');

function getFilePath(collection) {
  return path.join(dataDir, `${collection}.json`);
}

function readCollection(collection) {
  const filePath = getFilePath(collection);
  if (!fs.existsSync(filePath)) return [];
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

function writeCollection(collection, data) {
  const filePath = getFilePath(collection);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function addToCollection(collection, item) {
  const data = readCollection(collection);
  item._id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  item.createdAt = new Date().toISOString();
  data.unshift(item);
  if (data.length > 50) data.pop();
  writeCollection(collection, data);
  return item;
}

function getCollection(collection, limit = 20) {
  const data = readCollection(collection);
  return data.slice(0, limit);
}

module.exports = { addToCollection, getCollection };
