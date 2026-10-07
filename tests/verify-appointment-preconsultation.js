const patientId = "11111111-1111-4111-8111-111111111111";
const otherPatientId = "22222222-2222-4222-8222-222222222222";
const appointmentId = "33333333-3333-4333-8333-333333333333";
const conversationId = "44444444-4444-4444-8444-444444444444";
const summaryId = "55555555-5555-4555-8555-555555555555";
const correlationId = "66666666-6666-4666-8666-666666666666";

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

db.outbox_events.deleteMany({});
db.preconsultation_summaries.deleteMany({});
db.messages.deleteMany({});
db.conversations.deleteMany({});

db.conversations.insertOne({
  _id: conversationId,
  patientId,
  appointmentId,
  startDateTime: new Date(),
  status: "ACTIVE",
  questionLimit: 8,
  questionsAsked: 0,
  createdAt: new Date(),
  updatedAt: new Date()
});

expectMongoError("conversation without appointment", 121, () =>
  db.conversations.insertOne({
    _id: "77777777-7777-4777-8777-777777777777",
    patientId: otherPatientId,
    startDateTime: new Date(),
    status: "ACTIVE",
    questionLimit: 8,
    questionsAsked: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  })
);

expectMongoError("questions exceed configured limit", 121, () =>
  db.conversations.insertOne({
    _id: "88888888-8888-4888-8888-888888888888",
    patientId: otherPatientId,
    appointmentId: "99999999-9999-4999-8999-999999999999",
    startDateTime: new Date(),
    status: "ACTIVE",
    questionLimit: 8,
    questionsAsked: 9,
    createdAt: new Date(),
    updatedAt: new Date()
  })
);

expectMongoError("finished conversation without finalization reason", 121, () =>
  db.conversations.insertOne({
    _id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    patientId: otherPatientId,
    appointmentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    startDateTime: new Date(),
    endDateTime: new Date(),
    status: "FINISHED",
    questionLimit: 8,
    questionsAsked: 8,
    createdAt: new Date(),
    updatedAt: new Date()
  })
);

expectMongoError("duplicate appointment preconsultation", 11000, () =>
  db.conversations.insertOne({
    _id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    patientId: otherPatientId,
    appointmentId,
    startDateTime: new Date(),
    status: "ACTIVE",
    questionLimit: 8,
    questionsAsked: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  })
);

db.preconsultation_summaries.insertOne({
  _id: summaryId,
  conversationId,
  appointmentId,
  patientId,
  consultationReason: "Dolor de cabeza",
  createdAt: new Date()
});

expectMongoError("summary without appointment", 121, () =>
  db.preconsultation_summaries.insertOne({
    _id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    conversationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    patientId,
    consultationReason: "Missing appointment",
    createdAt: new Date()
  })
);

db.outbox_events.insertOne({
  _id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  eventType: "PreConsultationSummaryGenerated",
  aggregateType: "PRECONSULTATION_SUMMARY",
  aggregateId: summaryId,
  correlationId,
  status: "PENDING",
  occurredAt: new Date(),
  createdAt: new Date(),
  payload: {
    summaryId,
    appointmentId,
    patientId,
    conversationId,
    generatedAt: new Date()
  }
});

const expectedIndexes = [
  ["conversations", "uq_conversations_appointment"],
  ["preconsultation_summaries", "uq_summaries_appointment"]
];

for (const [collection, indexName] of expectedIndexes) {
  const exists = db
    .getCollection(collection)
    .getIndexes()
    .some(index => index.name === indexName);

  if (!exists) {
    throw new Error(`Missing index: ${collection}.${indexName}`);
  }
}

db.outbox_events.deleteMany({});
db.preconsultation_summaries.deleteMany({});
db.conversations.deleteMany({});

print("HU-06 appointment-linked pre-consultation tests passed.");
