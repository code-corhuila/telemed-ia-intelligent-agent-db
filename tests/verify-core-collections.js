const collections = [
  "conversations",
  "messages",
  "preconsultation_summaries"
];

for (const name of collections) {
  if (!db.getCollectionNames().includes(name)) {
    throw new Error(`Missing collection: ${name}`);
  }
}

const patientId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";
const messageId = "33333333-3333-4333-8333-333333333333";
const summaryId = "44444444-4444-4444-8444-444444444444";

const appointmentId = "aaaaaaaa-1111-4111-8111-111111111111";
const invalidStatusAppointmentId =
  "aaaaaaaa-2222-4222-8222-222222222222";
const clinicalFieldAppointmentId =
  "aaaaaaaa-3333-4333-8333-333333333333";
const finishedAppointmentId =
  "aaaaaaaa-4444-4444-8444-444444444444";
const secondActiveAppointmentId =
  "aaaaaaaa-5555-4555-8555-555555555555";
const missingReasonAppointmentId =
  "aaaaaaaa-6666-4666-8666-666666666666";
const duplicateSummaryAppointmentId =
  "aaaaaaaa-7777-4777-8777-777777777777";

const messageKey = "patient-msg-001";
const clinicalText =
  "Tengo dolor de cabeza desde hace tres d\u00edas.";

function expectMongoError(label, expectedCode, action) {
  try {
    action();
  } catch (error) {
    if (error.code === expectedCode) return;

    throw new Error(
      `${label}: expected MongoDB code ${expectedCode}, got ${error.code}: ${error.message}`
    );
  }

  throw new Error(
    `${label}: expected MongoDB error ${expectedCode}`
  );
}

db.messages.deleteMany({});
db.preconsultation_summaries.deleteMany({});
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

db.messages.insertOne({
  _id: messageId,
  conversationId,
  sender: "PATIENT",
  idempotencyKey: messageKey,
  content: clinicalText,
  timestamp: new Date()
});

const storedMessage = db.messages.findOne({
  _id: messageId
});

if (storedMessage.content !== clinicalText) {
  throw new Error(
    "Clinical UTF-8 text was not preserved"
  );
}

db.preconsultation_summaries.insertOne({
  _id: summaryId,
  conversationId,
  appointmentId,
  patientId,
  consultationReason: "Dolor de cabeza",
  evolutionTime: "3 d\u00edas",
  detailedSymptoms:
    "Dolor frontal referido por el paciente.",
  relevantHistory:
    "Refiere episodios similares previos.",
  createdAt: new Date()
});

expectMongoError(
  "invalid conversation status",
  121,
  () =>
    db.conversations.insertOne({
      _id: "55555555-5555-4555-8555-555555555555",
      patientId:
        "12121212-1212-4121-8121-121212121212",
      appointmentId: invalidStatusAppointmentId,
      startDateTime: new Date(),
      status: "DIAGNOSED",
      questionLimit: 8,
      questionsAsked: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
);

expectMongoError(
  "undeclared clinical field",
  121,
  () =>
    db.conversations.insertOne({
      _id: "66666666-6666-4666-8666-666666666666",
      patientId:
        "13131313-1313-4131-8131-131313131313",
      appointmentId: clinicalFieldAppointmentId,
      startDateTime: new Date(),
      status: "ACTIVE",
      questionLimit: 8,
      questionsAsked: 0,
      diagnosis: "Not allowed",
      createdAt: new Date(),
      updatedAt: new Date()
    })
);

expectMongoError(
  "finished conversation without endDateTime",
  121,
  () =>
    db.conversations.insertOne({
      _id: "77777777-7777-4777-8777-777777777777",
      patientId:
        "99999999-9999-4999-8999-999999999999",
      appointmentId: finishedAppointmentId,
      startDateTime: new Date(),
      status: "FINISHED",
      questionLimit: 8,
      questionsAsked: 8,
      finalizationReason: "COMPLETED",
      createdAt: new Date(),
      updatedAt: new Date()
    })
);

expectMongoError(
  "invalid message sender",
  121,
  () =>
    db.messages.insertOne({
      _id: "88888888-8888-4888-8888-888888888888",
      conversationId,
      sender: "DOCTOR",
      idempotencyKey: "invalid-msg-001",
      content: "Invalid sender",
      timestamp: new Date()
    })
);

expectMongoError(
  "duplicate message retry",
  11000,
  () =>
    db.messages.insertOne({
      _id: "99999999-9999-4999-8999-999999999999",
      conversationId,
      sender: "PATIENT",
      idempotencyKey: messageKey,
      content: clinicalText,
      timestamp: new Date()
    })
);

expectMongoError(
  "summary without consultation reason",
  121,
  () =>
    db.preconsultation_summaries.insertOne({
      _id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      conversationId:
        "abababab-abab-4bab-8bab-abababababab",
      appointmentId: missingReasonAppointmentId,
      patientId,
      createdAt: new Date()
    })
);

const indexes = [
  [
    "conversations",
    "uq_conversations_active_patient"
  ],
  [
    "conversations",
    "uq_conversations_appointment"
  ],
  [
    "messages",
    "idx_messages_conversation_timestamp"
  ],
  [
    "messages",
    "uq_messages_conversation_sender_idempotency"
  ],
  [
    "preconsultation_summaries",
    "uq_summaries_conversation"
  ],
  [
    "preconsultation_summaries",
    "uq_summaries_appointment"
  ],
  [
    "preconsultation_summaries",
    "idx_summaries_patient"
  ]
];

for (const [collection, indexName] of indexes) {
  const exists = db
    .getCollection(collection)
    .getIndexes()
    .some(index => index.name === indexName);

  if (!exists) {
    throw new Error(
      `Missing index: ${collection}.${indexName}`
    );
  }
}

expectMongoError(
  "second active conversation",
  11000,
  () =>
    db.conversations.insertOne({
      _id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      patientId,
      appointmentId: secondActiveAppointmentId,
      startDateTime: new Date(),
      status: "ACTIVE",
      questionLimit: 8,
      questionsAsked: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
);

expectMongoError(
  "duplicate summary",
  11000,
  () =>
    db.preconsultation_summaries.insertOne({
      _id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      conversationId,
      appointmentId: duplicateSummaryAppointmentId,
      patientId,
      consultationReason: "Repeated summary",
      createdAt: new Date()
    })
);

db.messages.deleteMany({});
db.preconsultation_summaries.deleteMany({});
db.conversations.deleteMany({});

print(
  "Core HU-06 MongoDB validation tests passed."
);