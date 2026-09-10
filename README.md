# SmartBlog

> An AI-powered personalized blogging platform for discovering, reading, creating, and discussing content.

## About the Project

SmartBlog is a personalized blogging platform designed to make blog discovery more relevant to individual users. Users can explore and read blogs, create and publish content, search for relevant blogs using NLP-based semantic search, maintain reading history, manage interests, receive personalized recommendations, and participate in questions and answers.

The project is currently under development.

## Features

- User registration and login
- User profile and account settings
- Create and publish blogs
- Explore and read blog posts
- Comments and community questions
- Reading history
- User interests
- NLP-based semantic search
- Personalized blog recommendations

## Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Python, Flask
- **Database:** MySQL
- **AI/NLP:** Natural Language Processing, Semantic Search, Recommendation System

## System Flow

```text
User
  ↓
SmartBlog Frontend
  ↓
Flask Backend
  ↓
MySQL Database
  │
  ├── Users
  ├── Blogs
  ├── Comments
  ├── Questions & Answers
  ├── Reading History
  └── User Interests
  │
  ├── NLP Semantic Search
  │
  └── Personalized Recommendations

# Database Design

SmartBlog uses MySQL as its primary database.

| Table             | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `users`           | Stores user account information           |
| `blogs`           | Stores blog posts and authors             |
| `comments`        | Stores comments on blogs                  |
| `questions`       | Stores questions related to blogs         |
| `answers`         | Stores answers to questions               |
| `reading_history` | Tracks blogs read by users                |
| `user_interests`  | Stores user interests for personalization |

# Main Relationships

users
 ├── blogs
 ├── comments
 ├── questions
 ├── answers
 ├── reading_history
 └── user_interests

blogs
 ├── comments
 ├── questions
 └── reading_history

questions
 └── answers

 # Project Structure

 SmartBlog/
├── README.md
├── home.html
├── dashboard.html
├── login.html
├── signup.html
├── explore.html
├── search.html
├── create-blog.html
├── blog.html
├── questions.html
├── profile.html
├── settings.html
├── *.css
└── script.js

# Development Status

- Completed

Frontend pages and UI
Consistent logged-in navigation
Initial MySQL database schema

- Upcoming

Flask backend
User registration and authentication
Database integration
Dynamic blog content
Comments and Q&A
Reading history and interests
NLP semantic search
Personalized recommendation system

# Developer

Nisha Sahni
B.Tech Mathematics & Computing
MITS Gwalior

SmartBlog is an individual academic and learning project developed by Nisha Sahni.