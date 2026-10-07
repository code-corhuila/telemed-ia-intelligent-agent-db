const expectedCollections = [
  "conversations",
  "messages",
  "preconsultation_summaries"
];

for (const collectionName of expectedCollections) {
  if (!db.getCollectionNames().includes(collectionName)) {
    throw new Error(`Missing collection: ${collectionName}`);
  }
}

const patientId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";
const messageId = "33333333-3333-4333-8333-333333333333";
const summaryId = "44444444-4444-4444-8444-444444444444";

function expectRejected(label, action) {
  let rejected = false;

  try {
    action();
  } catch (error) {
    rejected = true;
  }

  if (!rejected) {
    throw new Error(`Expected validation rejection: ${label}`);
  }
}

db.conversations.deleteMany({ _id: conversationId });
db.messages.deleteMany({ _id: messageId });
db.preconsultation_summaries.deleteMany({ _id: summaryId });

db.conversations.insertOne({
  _id: conversationId,
  patientId,
  startDateTime: new Date(),
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date()
});

db.messages.insertOne({
  _id: messageId,
  conversationId,
  sender: "PATIENT",
  content: "Tengo dolor de cabeza desde hace tres días.",
  timestamp: new Date()
});

db.preconsultation_summaries.insertOne({
  _id: summaryId,
  conversationId,
  patientId,
  consultationReason: "Dolor de cabeza",
  evolutionTime: "3 días",
  detailedSymptoms: "Dolor frontal referido por el paciente.",
  relevantHistory: "Refiere episodios similares previos.",
  createdAt: new Date()
});

expectRejected("invalid conversation status", () => {
  db.conversations.insertOne({
    _id: "55555555-5555-4555-8555-555555555555",
    patientId,
    startDateTime: new Date(),
    status: "DIAGNOSED",
    createdAt: new Date(),
    updatedAt: new Date()
  });
});

expectRejected("undeclared conversation field", () => {
  db.conversations.insertOne({
    _id: "66666666-6666-4666-8666-666666666666",
    patientId,
    startDateTime: new Date(),
    status: "ACTIVE",
    diagnosis: "Not allowed",
    createdAt: new Date(),
    updatedAt: new Date()
  });
});

expectRejected("invalid message sender", () => {
  db.messages.insertOne({
    _id: "77777777-7777-4777-8777-777777777777",
    conversationId,
    sender: "DOCTOR",
    content: "Invalid sender",
    timestamp: new Date()
  });
});

expectRejected("summary without consultation reason", () => {
  db.preconsultation_summaries.insertOne({
    _id: "88888888-8888-4888-8888-888888888888",
    conversationId,
    patientId,
    createdAt: new Date()
  });
});

const expectedIndexes = [
  ["conversations", "uq_conversations_active_patient"],
  ["messages", "idx_messages_conversation_timestamp"],
  ["preconsultation_summaries", "uq_summaries_conversation"],
  ["preconsultation_summaries", "idx_summaries_patient"]
];

for (const [collectionName, indexName] of expectedIndexes) {
  const exists = db.getCollection(collectionName)
    .getIndexes()
    .some(index => index.name === indexName);

  if (!exists) {
    throw new Error(`Missing index: ${collectionName}.${indexName}`);
  }
}

expectRejected("second active conversation for patient", () => {
  db.conversations.insertOne({
    _id: "99999999-9999-4999-8999-999999999999",
    patientId,
    startDateTime: new Date(),
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date()
  });
});

expectRejected("duplicate summary for conversation", () => {
  db.preconsultation_summaries.insertOne({
    _id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    conversationId,
    patientId,
    consultationReason: "Repeated summary",
    createdAt: new Date()
  });
});
db.conversations.deleteMany({});
db.messages.deleteMany({});
db.preconsultation_summaries.deleteMany({});

print("Core HU-06 MongoDB validation tests passed.");

