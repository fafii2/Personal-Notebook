import ICAL from 'ical.js';

const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:20260209T100000Z
DTEND:20260209T110000Z
DTSTAMP:20260209T064000Z
UID:123456789@google.com
CREATED:20260209T064000Z
DESCRIPTION:Test Event
LAST-MODIFIED:20260209T064000Z
LOCATION:
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:Test Assignment
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`;

try {
    console.log('Parsing sample ICS...');
    const jcal = ICAL.parse(sampleIcs);
    console.log('Parsed JCal:', JSON.stringify(jcal, null, 2));

    const comp = new ICAL.Component(jcal);
    console.log('Component created successfully');

    const events = comp.getAllSubcomponents('vevent');
    console.log(`Found ${events.length} events`);
} catch (error) {
    console.error('Error:', error);
}
