import request from 'supertest'
import { StatusCodes } from 'http-status-codes';
import { createApp } from '@/app';
import db from '@/database';

describe("POST /api/auth/login", () => {
    let app;

    beforeAll(async () => {
        app = createApp();
        await db.sequelize.sync({ force: true });

        await request(app)
            .post('/api/users')
            .send({ email: "jiyong@sch.ac.kr", password: "dudals123!", nickname: "test" });
    });

    test("[POST /api/auth/login] Success", async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: "jiyong@sch.ac.kr", password: "dudals123!"})
            .expect(res.status).toBe(StatusCodes.OK);
        
        const cookies = response.header['set-cookie'];
            const cookieKeys = cookies.map((cookie) => {
            const parts = cookie.split(';');
            const keyValuePair = parts[0].split('=');
            return keyValuePair[0];
        });

        expect(cookieKeys)
            .toContain('accessToken')
            .toContain('refreshToken');

        expect(response.body)
            .toHaveProperty("nickname");

        expect(response.body)
            .toHaveProperty("imageUrl");
            
        expect(response.body)
            .toHaveProperty("darkmode");
    });

    test("[POST /api/auth/login] Failed: ValidationError", async () => {
        await request(app)
            .post('/api/auth/login')
            .send({ email: "jiyong2", password: "dudals123!@" })
            .expect(StatusCodes.BAD_REQUEST)
            .expect({ message: "Data validation failed." });
    });

    test("[POST /api/auth/login] Failed: User not found", async () => {
        await request(app)
            .post('/api/auth/login')
            .send({ email: "fakedudals@naver.com", password: "dudals123!" })
            .expect(StatusCodes.NOT_FOUND)
            .expect({ message: "User not found." });
    });

    test("[POST /api/auth/login] Failed: Invalid password.", async () => {
        await request(app)
            .post('/api/users')
            .send({ email: "jiyong@sch.ac.kr", password: "dudals123!", nickname: "test" });

        await request(app)
            .post('/api/auth/login')
            .send({ email: "jiyong@sch.ac.kr", password: "dudals123!@" })
            .expect(StatusCodes.CONFLICT)
            .expect({ message: "Please check your email and password." });
    });
});

describe("POST /api/auth/refresh", () => {
    let app;

    beforeAll(async () => {
        app = createApp();
        await db.sequelize.sync({ force: true });
        
        await request(app)
            .post('/api/users')
            .send({ email: "jiyong@sch.ac.kr", password: "dudals123!", nickname: "test" });
    });
    
    test("[POST /api/auth/refresh] Success", async () => {
        await request(app) // 로컬 로그인으로 쿠키 발급
            .post('/api/users/login')
            .send({ email: "jiyong@sch.ac.kr", password: "dudals123!" });

        await request(app)
            .post('/api/auth/refresh')
            .expect(StatusCodes.OK);
    });
});

describe("GET /api/auth/logout", () => {
    let app;

    beforeAll(async () => {
        app = createApp();
        await db.sequelize.sync({ force: true });

        await request(app)
            .post('/api/users')
            .send({ email: "youngmin@sch.ac.kr", password: "dudals123!", nickname: "test" });
    });

    test("[GET /api/auth/logout] Success", async () => {
        await request(app) // 로컬 로그인으로 쿠키 발급
            .post('/api/users/login')
            .send({ email: "jiyong@sch.ac.kr", password: "dudals123!" });

        await request(app)
            .get('/api/auth/logout')
            .expect(StatusCodes.OK);
    });
});