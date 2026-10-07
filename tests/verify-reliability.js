const requiredCollections = ["idempotency_records", "outbox_events"];

for (const name of requiredCollections) {
  if (!db.getCollectionNames().includes(name)) {
    throw new Error(`Missing collection: ${name}`);
  }
}

const patientId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";
const summaryId = "33333333-3333-4333-8333-333333333333";
const eventId = "44444444-4444-4444-8444-444444444444";
const correlationId = "55555555-5555-4555-8555-555555555555";

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

db.idempotency_records.deleteMany({});
db.outbox_events.deleteMany({});

db.idempotency_records.insertOne({
  _id: "66666666-6666-4666-8666-666666666666",
  principalId: patientId,
  operation: "START_PRECONSULTATION",
  key: "start-preconsultation-001",
  resourceType: "CONVERSATION",
  resourceId: conversationId,
  createdAt: new Date()
});

expectMongoError("duplicate idempotency key", 11000, () =>
  db.idempotency_records.insertOne({
    _id: "77777777-7777-4777-8777-777777777777",
    principalId: patientId,
    operation: "START_PRECONSULTATION",
    key: "start-preconsultation-001",
    resourceType: "CONVERSATION",
    resourceId: "88888888-8888-4888-8888-888888888888",
    createdAt: new Date()
  })
);

expectMongoError("short idempotency key", 121, () =>
  db.idempotency_records.insertOne({
    _id: "99999999-9999-4999-8999-999999999999",
    principalId: patientId,
    operation: "SEND_MESSAGE",
    key: "short",
    resourceType: "MESSAGE",
    resourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdAt: new Date()
  })
);

db.outbox_events.insertOne({
  _id: eventId,
  eventType: "PreConsultationSummaryGenerated",
  aggregateType: "PRECONSULTATION_SUMMARY",
  aggregateId: summaryId,
  correlationId,
  status: "PENDING",
  occurredAt: new Date(),
  createdAt: new Date(),
  payload: {
    summaryId,
    patientId,
    conversationId,
    generatedAt: new Date()
  }
});

expectMongoError("duplicate summary generated event", 11000, () =>
  db.outbox_events.insertOne({
    _id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    eventType: "PreConsultationSummaryGenerated",
    aggregateType: "PRECONSULTATION_SUMMARY",
    aggregateId: summaryId,
    correlationId,
    status: "PENDING",
    occurredAt: new Date(),
    createdAt: new Date(),
    payload: {
      summaryId,
      patientId,
      conversationId,
      generatedAt: new Date()
    }
  })
);

expectMongoError("clinical content in outbox payload", 121, () =>
  db.outbox_events.insertOne({
    _id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    eventType: "PreConsultationSummaryGenerated",
    aggregateType: "PRECONSULTATION_SUMMARY",
    aggregateId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    correlationId,
    status: "PENDING",
    occurredAt: new Date(),
    createdAt: new Date(),
    payload: {
      summaryId,
      patientId,
      conversationId,
      generatedAt: new Date(),
      diagnosis: "Not allowed"
    }
  })
);

const expectedIndexes = [
  ["idempotency_records", "uq_idempotency_principal_operation_key"],
  ["outbox_events", "uq_outbox_summary_event"],
  ["outbox_events", "idx_outbox_status_occurred_at"]
];

for (const [collection, indexName] of expectedIndexes) {
  if (!db.getCollection(collection).getIndexes().some(i => i.name === indexName)) {
    throw new Error(`Missing index: ${collection}.${indexName}`);
  }
}

db.idempotency_records.deleteMany({});
db.outbox_events.deleteMany({});

print("HU-06 reliability persistence tests passed.");
