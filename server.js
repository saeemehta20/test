const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const session = require('express-session');

const app = express();

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Create upload directories if they don't exist
const uploadDirs = [
  "uploads",
  "uploads/profiles",
  "uploads/covers",
  "uploads/books",
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === "photo") {
      cb(null, "uploads/profiles/");
    } else if (file.fieldname === "coverImage") {
      cb(null, "uploads/covers/");
    } else if (file.fieldname === "bookFile") {
      cb(null, "uploads/books/");
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files first (CSS, JS, images)
app.use('/styles.css', express.static(path.join(__dirname, 'styles.css')));
app.use('/script.js', express.static(path.join(__dirname, 'script.js')));
app.use('/fetch.js', express.static(path.join(__dirname, 'fetch.js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  profilePhoto: {
    type: String,
  },
});

// Book Schema
const bookSchema = new mongoose.Schema({
  title: String,
  genre: String,
  description: String,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  coverImage: String,
  bookFile: String,
  readingProgress: {
    currentPage: { type: Number, default: 0 },
    totalPages: { type: Number, default: 0 },
    lastReadAt: { type: Date },
    isCompleted: { type: Boolean, default: false },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Book = mongoose.model("Book", bookSchema);

// Create models
const User = mongoose.model("User", userSchema);

// MongoDB Connection
mongoose
  .connect(
    "mongodb+srv://sachinchaurasiya69:606280Sk@tesing.8vhz1.mongodb.net/bookreader",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Connected to MongoDB successfully");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/signin');
  }
  next();
};

// Routes
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    // Save user to database
    await user.save();

    // Set session
    req.session.userId = user._id;
    req.session.userName = user.name;

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Set session
    req.session.userId = user._id;
    req.session.userName = user.name;

    res.json({ 
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error signing in" });
  }
});

// Logout route
app.get('/api/auth/logout', (req, res) => {
  // Clear the session
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Error during logout' });
    }
    
    // Clear the session cookie
    res.clearCookie('connect.sid');
    
    // Set cache control headers to prevent caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json({ message: 'Logged out successfully' });
  });
});

// User profile endpoints
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user data" });
  }
});

app.post(
  "/api/auth/upload-photo",
  requireAuth,
  upload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No photo uploaded" });
      }

      const user = await User.findById(req.session.userId);
      user.profilePhoto = `/uploads/profiles/${req.file.filename}`;
      await user.save();

      res.json({ photoUrl: user.profilePhoto });
    } catch (error) {
      console.error("Error uploading photo:", error);
      res.status(500).json({ message: "Error uploading photo" });
    }
  }
);

// Book management endpoints
app.get("/api/books/my-books", requireAuth, async (req, res) => {
  try {
    console.log("\n=== Fetching Books from Database ===");
    console.log("Database: bookreader");
    console.log("Collection: books\n");

    // Fetch only books where the author is the logged-in user
    const books = await Book.find({ author: req.session.userId })
      .populate("author", "name email")
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Total books found: ${books.length}`);

    // Send response to client
    res.json({
      books: books.map((book) => ({
        ...book,
        _id: book._id.toString(),
        author: book.author
          ? {
              _id: book.author._id.toString(),
              name: book.author.name,
              email: book.author.email,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({
      message: "Error fetching books",
      error: error.message,
    });
  }
});

// Book upload endpoint
app.post(
  "/api/books",
  requireAuth,
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "bookFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, genre, description } = req.body;

      const book = new Book({
        title,
        genre,
        description,
        author: req.session.userId,
        coverImage: req.files["coverImage"]
          ? `/uploads/covers/${req.files["coverImage"][0].filename}`
          : null,
        bookFile: req.files["bookFile"]
          ? `/uploads/books/${req.files["bookFile"][0].filename}`
          : null,
      });

      await book.save();

      res.status(201).json({
        message: "Book uploaded successfully",
        book: {
          ...book.toObject(),
          _id: book._id.toString(),
          author: {
            _id: req.session.userId.toString(),
            name: req.session.userName,
          },
        },
      });
    } catch (error) {
      console.error("Error uploading book:", error);
      res.status(500).json({
        message: "Error uploading book",
        error: error.message,
      });
    }
  }
);

// Update reading progress endpoint
app.post("/api/books/:id/progress", requireAuth, async (req, res) => {
  try {
    const { currentPage, totalPages } = req.body;

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    book.readingProgress = {
      currentPage,
      totalPages,
      lastReadAt: new Date(),
      isCompleted: currentPage >= totalPages,
    };

    await book.save();

    res.json({
      message: "Reading progress updated",
      progress: book.readingProgress,
    });
  } catch (error) {
    console.error("Error updating reading progress:", error);
    res.status(500).json({
      message: "Error updating reading progress",
      error: error.message,
    });
  }
});

// Public routes (no auth required)
app.get("/signin", (req, res) => {
  if (req.session.userId) {
    return res.redirect('/home');
  }
  res.sendFile(path.join(__dirname, "signin.html"));
});

app.get("/signup", (req, res) => {
  if (req.session.userId) {
    return res.redirect('/home');
  }
  res.sendFile(path.join(__dirname, "signup.html"));
});

// Root route - always show signin
app.get("/", (req, res) => {
  if (req.session.userId) {
    return res.redirect('/home');
  }
  res.redirect('/signin');
});

// Protected routes (auth required)
app.get("/home", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/search", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "search.html"));
});

app.get("/publish", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "publish.html"));
});

app.get("/about", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "about.html"));
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});


app.get("/preview", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "preivew.html"));
});
// Handle 404 errors
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
});
