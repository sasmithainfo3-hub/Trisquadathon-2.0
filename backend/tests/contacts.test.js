import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { TrustedContact } from '../src/models/TrustedContact.js';

describe('Trusted Contacts Endpoints', () => {
  let authToken = null;
  let userId = null;

  beforeAll(async () => {
    process.env.USE_MEMORY_DB = 'true';
    await connectDb();
    await User.deleteMany({});
    await TrustedContact.deleteMany({});

    const user = await User.create({
      name: 'Contact Tester',
      email: 'tester@safepath.test',
      passwordHash: await User.hashPassword('Pass12345!')
    });
    userId = user._id;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tester@safepath.test', password: 'Pass12345!' });

    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('creates and invites a new trusted contact', async () => {
    const res = await request(app)
      .post('/api/v1/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Jane Contact',
        email: 'jane@contact.test',
        phone: '+15559876543',
        relationship: 'Sister',
        priorityOrder: 1
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.contact.name).toBe('Jane Contact');
    expect(res.body.contact.status).toBe('pending');
    expect(res.body.contact.verificationToken).toBeDefined();
  });

  it('lists user trusted contacts ordered by priority', async () => {
    const res = await request(app)
      .get('/api/v1/contacts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.contacts.length).toBe(1);
    expect(res.body.contacts[0].email).toBe('jane@contact.test');
  });

  it('verifies a contact invitation via public verification endpoint', async () => {
    const contact = await TrustedContact.findOne({ email: 'jane@contact.test' });
    expect(contact).toBeDefined();

    const getRes = await request(app).get(`/api/v1/contacts/verify/${contact.verificationToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.contact.name).toBe('Jane Contact');

    const postRes = await request(app)
      .post(`/api/v1/contacts/verify/${contact.verificationToken}`)
      .send({ action: 'accept' });

    expect(postRes.status).toBe(200);
    expect(postRes.body.success).toBe(true);

    const verified = await TrustedContact.findById(contact._id);
    expect(verified.status).toBe('verified');
  });
});
