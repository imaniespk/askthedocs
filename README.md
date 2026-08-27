AskTheDocs
AskTheDocs is a full-stack AI-powered document question-answering application that allows users to upload documents and ask questions about their content using natural language.
The system processes uploaded documents, splits their content into smaller chunks, generates vector embeddings, and stores them in PostgreSQL using pgvector. When a user asks a question, AskTheDocs retrieves the most relevant document chunks and uses them as context for the language model to generate a grounded response with relevant source citations.
Academic Team Project AskTheDocs was developed as a team project for the Distributed Computing course at Wright State University.
Live Application
Frontend: https://askthedocs-omega.vercel.app/
Backend: https://askthedocs.onrender.com

Features
* User registration and login
* JWT-based authentication
* Upload PDF, DOCX, and TXT documents
* Automatic document text extraction
* Document chunking and embedding generation
* Semantic search using PostgreSQL and pgvector
* Ask questions using natural language
* AI-generated responses grounded in uploaded documents
* Relevant source citations with responses
* OpenAI integration
* Gemini fallback when the primary AI response fails
* Conversation history
* Rename and delete conversations
* Export conversations as text files
* User usage statistics
* Create and join collaboration groups
* Share documents with group members
* Ask questions across shared group documents
* Document ownership and access control
* Background document processing
* Document processing status tracking

Technology Stack
Frontend
* React
* TypeScript
* Vite
* Vercel
Backend
* Python
* FastAPI
* AsyncPG
* Pydantic
* JWT
* bcrypt
Database
* Supabase
* PostgreSQL
* pgvector
* IVFFlat vector indexing
AI and Document Processing
* OpenAI API
* OpenAI Embeddings
* Gemini API fallback
* pdfplumber
* python-docx
Deployment
* Vercel — Frontend
* Render — Backend
* Supabase — PostgreSQL database and vector storage

System Architecture
flowchart TD
    A[React + TypeScript Frontend] --> B[FastAPI Backend]

    B --> C[Authentication & API Routes]
    B --> D[Document Processing]
    B --> E[Conversation & Group Services]

    D --> F[Text Extraction]
    F --> G[Document Chunking]
    G --> H[OpenAI Embeddings]

    H --> I[Supabase PostgreSQL + pgvector]

    C --> I
    E --> I

    J[User Question] --> B
    B --> K[Question Embedding]
    K --> I

    I --> L[Vector Similarity Search]
    L --> M[Relevant Document Chunks]

    M --> N[OpenAI]
    N --> O[Grounded Answer + Citations]

    N -. Fallback .-> P[Gemini]
    P --> O

How AskTheDocs Works
1. Document Upload
A user uploads a supported document:
* PDF
* DOCX
* TXT
The backend validates the file and creates a document record.
Uploaded source files are currently stored on the backend filesystem, while document metadata, extracted chunks, embeddings, conversations, messages, users, and group-related data are stored in Supabase PostgreSQL.
2. Text Extraction
The backend extracts text using:
* pdfplumber for PDF files
* python-docx for DOCX files
* Native text reading for TXT files
3. Document Chunking
Extracted text is divided into smaller chunks so that large documents can be processed and searched efficiently.
4. Embedding Generation
Each chunk is converted into a vector embedding using OpenAI's embedding model.
The embedding and corresponding text chunk are stored in PostgreSQL using the pgvector extension.
5. User Question
When the user asks a question, the question is also converted into an embedding.
6. Semantic Retrieval
The question embedding is compared with stored document embeddings using vector similarity search.
The most relevant document chunks are selected as context for the language model.
7. AI Response
The selected chunks are provided to the language model along with the user's question.
The application generates an answer based on the retrieved document content and returns relevant source citations.
Gemini is available as a fallback when the primary AI provider is unavailable.

Retrieval-Augmented Generation Flow
Document Upload
      ↓
Text Extraction
      ↓
Document Chunking
      ↓
Embedding Generation
      ↓
Supabase PostgreSQL + pgvector
      ↓
      ↓
User Question
      ↓
Question Embedding
      ↓
Vector Similarity Search
      ↓
Relevant Document Chunks
      ↓
LLM Context
      ↓
Grounded Answer
      ↓
Source Citations

Authentication and Access Control
AskTheDocs uses JWT-based authentication.
After successful login, protected requests send an authorization token:
Authorization: Bearer <token>
Passwords are hashed before being stored.
Authentication and authorization are used to ensure that users can only access resources they own or documents that have been shared with groups they belong to.

Group Collaboration
AskTheDocs supports collaborative document access.
Users can:
* Create a group
* Join a group using an invite code
* View group members
* Share owned documents with a group
* View shared documents
* Ask questions using shared group documents
* Remove shared documents
* Delete groups they own
Access control is enforced so that users cannot access private documents belonging to unrelated users.

Project Structure
askthedocs/
├── backend/
│   ├── app/
│   │   ├── db/
│   │   ├── routes/
│   │   ├── worker/
│   │   ├── auth.py
│   │   ├── config.py
│   │   ├── dependencies.py
│   │   └── main.py
│   ├── migrations/
│   ├── .env.example
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── .env.example
│   └── package.json
│
├── .gitignore
├── render.yaml
└── README.md

Running the Project Locally
Prerequisites
Make sure you have:
* Python
* Node.js and npm
* PostgreSQL/Supabase database
* OpenAI API key
* Gemini API key

1. Clone the Repository
git clone https://github.com/imaniespk/askthedocs.git
cd askthedocs

2. Configure the Backend
Navigate to the backend:
cd backend
Create a Python environment using your preferred environment manager.
For example:
python -m venv venv
Activate it on macOS/Linux:
source venv/bin/activate
On Windows:
venv\Scripts\activate
Install dependencies:
pip install -r requirements.txt
Create your local environment file from the provided example:
cp .env.example .env
Configure the required values inside .env.
Example:
ENV=development

DATABASE_URL=

OPENAI_API_KEY=
GEMINI_API_KEY=

JWT_SECRET=
JWT_EXPIRE_MINUTES=60

CORS_ORIGINS=http://localhost:5173

MAX_UPLOAD_SIZE_MB=10
Never commit your real .env file or API credentials.
Start the backend:
uvicorn app.main:app --reload
The backend will normally run at:
http://localhost:8000

3. Configure the Frontend
Open another terminal and navigate to the frontend:
cd frontend
Install dependencies:
npm install
Create the frontend environment file:
cp .env.example .env
Configure:
VITE_API_URL=http://localhost:8000
Start the frontend:
npm run dev
The frontend will normally run at:
http://localhost:5173
Open that address in your browser.

Environment Variables
Important backend environment variables include:
Variable	Purpose
DATABASE_URL	PostgreSQL/Supabase connection
OPENAI_API_KEY	OpenAI API access
GEMINI_API_KEY	Gemini fallback API access
JWT_SECRET	JWT signing secret
JWT_EXPIRE_MINUTES	Authentication token expiration
CORS_ORIGINS	Allowed frontend origins
MAX_UPLOAD_SIZE_MB	Maximum document upload size
Production secrets are configured through the hosting platforms and are not stored in the repository.

My Contributions
This application was developed collaboratively as a team project.
My primary contributions included:
* Built the initial FastAPI backend structure and project setup.
* Implemented JWT authentication and user-scoped document and conversation APIs.
* Developed document upload, file access, duplicate-upload validation, and document-processing improvements.
* Implemented group-based document sharing and group-scoped document querying.
* Added Gemini fallback support for AI responses.
* Improved multi-document retrieval so relevant chunks could be selected across multiple documents for better context and citations.
* Implemented conversation management features including rename, delete, and conversation export.
* Developed user usage-statistics functionality.
* Worked on deployment configuration and production integration using Render and Vercel.
* Debugged authentication, routing, deployment, and document-processing issues during development.
The Git commit history contains the individual contributions made throughout the project.

What I Learned
Building AskTheDocs provided practical experience with:
* Designing REST APIs using FastAPI
* Building asynchronous backend services
* Working directly with PostgreSQL using AsyncPG
* Implementing JWT authentication
* Designing user-level authorization and access control
* Processing different document formats
* Working with background tasks
* Implementing vector embeddings
* Using PostgreSQL pgvector
* Building semantic search
* Understanding retrieval-augmented generation
* Integrating multiple AI providers
* Creating document-grounded responses with citations
* Developing collaborative document-sharing functionality
* Deploying frontend and backend applications separately
* Debugging production deployment issues
* Collaborating with another developer using Git and GitHub

Current Limitations
The current version stores original uploaded documents on the backend filesystem.
For a larger production deployment, uploaded documents should be moved to persistent object storage such as Supabase Storage, Amazon S3, or another cloud storage service.
Additional improvements could also be made to background-job processing, automated testing, monitoring, retrieval quality, and scalability.

Future Improvements
Potential improvements include:
* Move uploaded documents to persistent cloud object storage
* Add a dedicated background task queue
* Expand automated unit and integration testing
* Add rate limiting
* Improve application logging and monitoring
* Add pagination for documents and conversations
* Improve large-document processing
* Add retrieval reranking
* Improve semantic-search quality
* Add stronger file validation and security
* Add document-processing retry mechanisms
* Improve application performance under concurrent usage

Contributors
AskTheDocs was developed collaboratively by:
* Manish Sapkota
* Sushan Paudel

Project Status
AskTheDocs is an academic team project maintained as a portfolio project demonstrating full-stack software development, asynchronous backend development, document processing, semantic search, vector databases, authentication, collaborative access control, AI integration, and cloud deployment.
