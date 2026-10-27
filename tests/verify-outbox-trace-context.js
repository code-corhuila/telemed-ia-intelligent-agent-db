// Week 11 observability: an outbox event may carry the W3C trace context of the request
// that produced it, so the relay can continue the same trace across RabbitMQ.

const patientId =
  "11111111-1111-4111-8111-111111111111";

const conversationId =
  "22222222-2222-4222-8222-222222222222";

const appointmentId =
  "12121212-1212-4121-8121-121212121212";

const correlationId =
  "55555555-5555-4555-8555-555555555555";

function expectMongoError(
  label,
  expectedCode,
  action
) {
  try {
    action();
  } catch (error) {
    if (error.code === expectedCode) {
      return;
    }

    throw new Error(
      `${label}: expected MongoDB code ${expectedCode}, got ${error.code}: ${error.message}`
    );
  }

  throw new Error(
    `${label}: expected MongoDB error ${expectedCode}`
  );
}

function summaryEvent(eventId, summaryId, extra) {
  return Object.assign(
    {
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
        appointmentId,
        patientId,
        conversationId,
        generatedAt: new Date()
      }
    },
    extra
  );
}

db.outbox_events.deleteMany({});

db.outbox_events.insertOne(
  summaryEvent(
    "71717171-7171-4717-8717-717171717171",
    "81818181-8181-4818-8818-818181818181",
    {
      traceparent:
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
    }
  )
);

db.outbox_events.insertOne(
  summaryEvent(
    "72727272-7272-4727-8727-727272727272",
    "82828282-8282-4828-8828-828282828282",
    {}
  )
);

expectMongoError(
  "malformed traceparent",
  121,
  () =>
    db.outbox_events.insertOne(
      summaryEvent(
        "73737373-7373-4737-8737-737373737373",
        "83838383-8383-4838-8838-838383838383",
        { traceparent: "trace-4bf92f35" }
      )
    )
);

expectMongoError(
  "traceparent with uppercase hex",
  121,
  () =>
    db.outbox_events.insertOne(
      summaryEvent(
        "74747474-7474-4747-8747-747474747474",
        "84848484-8484-4848-8848-848484848484",
        {
          traceparent:
            "00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01"
        }
      )
    )
);

expectMongoError(
  "traceparent that is not a string",
  121,
  () =>
    db.outbox_events.insertOne(
      summaryEvent(
        "75757575-7575-4757-8757-757575757575",
        "85858585-8585-4858-8858-858585858585",
        { traceparent: { traceId: "4bf92f3577b34da6a3ce929d0e0e4736" } }
      )
    )
);

db.outbox_events.deleteMany({});

print("OUTBOX TRACE CONTEXT CHECKS PASSED");
