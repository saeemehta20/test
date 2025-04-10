const mongoose = require("mongoose");

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

// Create User model
const User = mongoose.model("User", userSchema);

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

// Connect to MongoDB
async function connectDB() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(
      "mongodb+srv://sachinchaurasiya69:606280Sk@tesing.8vhz1.mongodb.net/bookreader",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("Connected to MongoDB successfully!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

// Fetch books function
async function fetchBooks() {
  try {
    // Ensure we're connected to the database
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    console.log("\n=== Fetching Books from Database ===");
    console.log("Database: bookreader");
    console.log("Collection: books\n");

    // Fetch all books and populate author information
    const books = await Book.find().populate("author", "name email").lean();

    // Log results using console.table
    console.log(`Total books found: ${books.length}\n`);
    console.table(
      books.map((book) => ({
        Title: book.title,
        Genre: book.genre,
        Description: book.description,
        Author: book.author ? book.author.name : "Unknown",
        Created: new Date(book.createdAt).toLocaleString(),
      }))
    );

    // Log full JSON data
    console.log("\nFull book data:");
    console.log(JSON.stringify(books, null, 2));

    return books;
  } catch (error) {
    console.error("Error fetching books:", error);
    throw error;
  }
}

// Execute the fetch
connectDB()
  .then(() => fetchBooks())
  .then(() => {
    console.log("\nFetch operation completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Operation failed:", error);
    process.exit(1);
  });
