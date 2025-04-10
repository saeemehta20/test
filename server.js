const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();

// Create upload directories if they don't exist
const uploadDirs = ["uploads", "uploads/profiles"];
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
app.use(express.static(__dirname));
app.use("/uploads", express.static("uploads"));

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

// JWT Secret
const JWT_SECRET = "123456789"; // In production, use environment variable

// Middleware to verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new Error("No token provided");
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || !decoded.userId) {
      throw new Error("Invalid token format");
    }

    const user = await User.findOne({ _id: decoded.userId });

    if (!user) {
      throw new Error("User not found");
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error("Authentication error:", error.message);
    res.status(401).json({ message: "Please authenticate" });
  }
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

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Error signing in" });
  }
});

// User profile endpoints
app.get("/api/auth/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user data" });
  }
});

app.post(
  "/api/auth/upload-photo",
  auth,
  upload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No photo uploaded" });
      }

      const user = await User.findById(req.user._id);
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
app.get("/api/books/my-books", async (req, res) => {
  try {
    console.log("\n=== Fetching Books from Database ===");
    console.log("Database: bookreader");
    console.log("Collection: books\n");

    // Fetch all books and populate author information
    const books = await Book.find()
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

// Serve HTML files
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "signup.html"));
});

app.get("/signin", (req, res) => {
  res.sendFile(path.join(__dirname, "signin.html"));
});

app.get("/search", (req, res) => {
  res.sendFile(path.join(__dirname, "search.html"));
});

app.get("/publish", (req, res) => {
  res.sendFile(path.join(__dirname, "publish.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "about.html"));
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
