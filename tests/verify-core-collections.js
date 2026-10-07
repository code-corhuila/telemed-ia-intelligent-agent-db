const collections = ["conversations", "messages", "preconsultation_summaries"];

for (const name of collections) {
  if (!db.getCollectionNames().includes(name)) {
    throw new Error(`Missing collection: ${name}`);
  }
}

const patientId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";
const messageId = "33333333-3333-4333-8333-333333333333";
const summaryId = "44444444-4444-4444-8444-444444444444";
const messageKey = "patient-msg-001";
const clinicalText = "Tengo dolor de cabeza desde hace tres d\u00edas.";

function expectMongoError(label, expectedCode, action) {
  try {
    action();
  } catch (error) {
    if (error.code === expectedCode) return;

    throw new Error(
      `${label}: expected MongoDB code ${expectedCode}, got ${error.code}: ${error.message}`
    );
  }

  throw new Error(`${label}: expected MongoDB error ${expectedCode}`);
}

db.messages.deleteMany({});
db.preconsultation_summaries.deleteMany({});
db.conversations.deleteMany({});

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
  idempotencyKey: messageKey,
  content: clinicalText,
  timestamp: new Date()
});

const storedMessage = db.messages.findOne({ _id: messageId });

if (storedMessage.content !== clinicalText) {
  throw new Error("Clinical UTF-8 text was not preserved");
}

db.preconsultation_summaries.insertOne({
  _id: summaryId,
  conversationId,
  patientId,
  consultationReason: "Dolor de cabeza",
  evolutionTime: "3 d\u00edas",
  detailedSymptoms: "Dolor frontal referido por el paciente.",
  relevantHistory: "Refiere episodios similares previos.",
  createdAt: new Date()
});

expectMongoError("invalid conversation status", 121, () =>
  db.conversations.insertOne({
    _id: "55555555-5555-4555-8555-555555555555",
    patientId,
    startDateTime: new Date(),
    status: "DIAGNOSED",
    createdAt: new Date(),
    updatedAt: new Date()
  })
);

expectMongoError("undeclared clinical field", 121, () =>
  db.conversations.insertOne({
    _id: "66666666-6666-4666-8666-666666666666",
    patientId,
    startDateTime: new Date(),
    status: "ACTIVE",
    diagnosis: "Not allowed",
    createdAt: new Date(),
    updatedAt: new Date()
  })
);

expectMongoError("finished conversation without endDateTime", 121, () =>
  db.conversations.insertOne({
    _id: "77777777-7777-4777-8777-777777777777",
    patientId: "99999999-9999-4999-8999-999999999999",
    startDateTime: new Date(),
    status: "FINISHED",
    createdAt: new Date(),
    updatedAt: new Date()
  })
);

expectMongoError("invalid message sender", 121, () =>
  db.messages.insertOne({
    _id: "88888888-8888-4888-8888-888888888888",
    conversationId,
    sender: "DOCTOR",
    idempotencyKey: "invalid-msg-001",
    content: "Invalid sender",
    timestamp: new Date()
  })
);

expectMongoError("duplicate message retry", 11000, () =>
  db.messages.insertOne({
    _id: "99999999-9999-4999-8999-999999999999",
    conversationId,
    sender: "PATIENT",
    idempotencyKey: messageKey,
    content: clinicalText,
    timestamp: new Date()
  })
);

expectMongoError("summary without consultation reason", 121, () =>
  db.preconsultation_summaries.insertOne({
    _id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    conversationId,
    patientId,
    createdAt: new Date()
  })
);

const indexes = [
  ["conversations", "uq_conversations_active_patient"],
  ["messages", "idx_messages_conversation_timestamp"],
  ["messages", "uq_messages_conversation_sender_idempotency"],
  ["preconsultation_summaries", "uq_summaries_conversation"],
  ["preconsultation_summaries", "idx_summaries_patient"]
];

for (const [collection, indexName] of indexes) {
  if (!db.getCollection(collection).getIndexes().some(i => i.name === indexName)) {
    throw new Error(`Missing index: ${collection}.${indexName}`);
  }
}

expectMongoError("second active conversation", 11000, () =>
  db.conversations.insertOne({
    _id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    patientId,
    startDateTime: new Date(),
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date()
  })
);

expectMongoError("duplicate summary", 11000, () =>
  db.preconsultation_summaries.insertOne({
    _id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    conversationId,
    patientId,
    consultationReason: "Repeated summary",
    createdAt: new Date()
  })
);

db.messages.deleteMany({});
db.preconsultation_summaries.deleteMany({});
db.conversations.deleteMany({});

print("Core HU-06 MongoDB validation tests passed.");
