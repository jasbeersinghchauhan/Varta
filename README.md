# 🧩 Varta
Varta is a backend-focused real-time communication system designed to support secure 1-to-1 messaging and peer-to-peer video call signaling. The project emphasizes clean architecture, authentication security, concurrency handling, and scalable backend design using the Node.js ecosystem.

## 🚧 Project Status
This project is currently under active development.

The system architecture and design are finalized. Core backend features are being implemented in structured phases, starting with authentication and real-time messaging.

## 📌 Objective
Modern communication platforms require:
- Low-latency message delivery
- Secure authentication mechanism
- Persistent message storage
- Real-time bidirectional communication
- Scalable backend architecture

Varta is being built to explore and implement these backend engineering concepts in a structured and production-oriented manner.

## 🏗️ Architecture Overview
**Architecture Style:** Layered Monolithic (designed with scalability considerations)
```text
Client (Web / Mobile)
        ↓
REST API Layer (Express)
        ↓
Authentication Middleware (JWT)
        ↓
WebSocket Layer (Real-Time Messaging)
        ↓
Service Layer (Business Logic)
        ↓
Database Layer (MySQL)
        ↓
Optional Cache Layer (Redis)
```
The architecture separates concerns into distinct layers to ensure maintainability, testability, and future horizontal scalability.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| `Runtime` | Node.js |
| `Framework` | Express.js |
| `Real-Time Communication` | WebSocket |
| `Database` | MySQL |
| `Authentication` | JWT |
| `Password Security` | bcrypt |
| `Optional Caching` | Redis |
| `Video Call Signaling` | WebRTC(via WebSocket signaling) |

## 🔥 Planned Core Features
### 1. Authentication
- User registration and login
- Password hashing using bcrypt
- JWT-based stateless authentication
- Token validation middleware

### 2. Real-Time Messaging
- Persistent WebSocket connections
- 1-to-1 message delivery
- Message acknowledgment handling
- Online/offline presence tracking
- Message persistence in MySQL

### 3. Video Call Signaling (Planned Phase)
- WebRTC signaling over WebSocket
- SDP offer/answer exchange
- ICE candidate exchange

### 4. Security Considerations
- HTTPS-ready configuration
- JWT expiration handling
- Input validation
- Rate limiting (planned)
- Parameterized SQL queries
- CORS configuration

## 📡 Planned API Structure
### Authentication

| Method | Endpoint             | Description                      |
| ------ | -------------------- | -------------------------------- |
| POST   | `/api/auth/register` | Register new user                |
| POST   | `/api/auth/login`    | Authenticate user and return JWT |

### Messaging
| Method | Endpoint                | Description                  |
| ------ | ----------------------- | ---------------------------- |
| GET    | `/api/messages/:userId` | Retrieve chat history        |
| POST   | `/api/messages`         | Send message (HTTP fallback) |


## 🔌 Planned WebSocket Events
| Event             | Purpose                          |
| ----------------- | -------------------------------- |
| `connection`      | Client connection initialization |
| `private_message` | Send real-time message           |
| `message_ack`     | Delivery acknowledgment          |
| `typing`          | Typing indicator                 |
| `call_offer`      | WebRTC offer                     |
| `call_answer`     | WebRTC answer                    |
| `ice_candidate`   | ICE exchange                     |

## 🧪 Testing Strategy (Planned)
- Unit testing (Jest)
- API testing (Postman)
- WebSocket testing (browser client / wscat)

## 📈 Scalability Considerations
- Stateless JWT authentication (horizontal scaling ready)
- Redis-based session & presence tracking
- Message indexing for fast retrieval
- WebSocket clustering support
- Load balancer ready (Nginx compatible)

## 🔐 Security Considerations
- bcrypt password hashing
- Token expiration strategy
- Helmet middleware for HTTP headers
- Rate limiting to prevent brute-force attacks
- Prepared SQL statements
- CORS restrictions

## 📂 Project Structure
```text
VARTA/
│
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── database/
│   │   │   ├── middleware/
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── calls/
│   │   │   │   ├── conversation/
│   │   │   │   └── message/
│   │   │   ├── websocket/
│   │   │   ├── utils/
│   │   │   ├── app.js
│   │   │   └── index.js
│   │   ├── package-lock.json
│   │   └── package.json
│   │
│   └── web-client/
│       ├── public/
│       ├── src/
│       ├── index.html
│       └── package.json
│
├── docker/
├── docker-compose.yaml
├── .gitignore
└── README.md
```
## 📌 Future Enhancements
- End-to-end encryption
- Group messaging
- Media storage integration (S3 or equivalent)
- Message indexing and search
- Horizontal WebSocket scaling using Redis adapter
- Dockerized deployment

## 🎯 Learning Focus
This project is being built to demonstrate:
- Real-time backend system design
- WebSocket lifecycle management
- Authentication and authorization patterns
- Database schema design for messaging systems
- Secure API development
- Scalable backend architecture principles

## 👤 Author

**Jasbeer Singh Chauhan**

Backend Engineering | Node.js Stack