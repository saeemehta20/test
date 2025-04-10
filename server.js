const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// Create upload directories if they don't exist
const uploadDirs = ['uploads', 'uploads/covers', 'uploads/books', 'uploads/profiles'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'coverImage') {
            cb(null, 'uploads/covers/');
        } else if (file.fieldname === 'bookFile') {
            cb(null, 'uploads/books/');
        } else if (file.fieldname === 'photo') {
            cb(null, 'uploads/profiles/');
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// User Schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    profilePhoto: {
        type: String
    }
});

// Book Schema
const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    genre: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    coverImage: {
        type: String
    },
    bookFile: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create models
const User = mongoose.model('User', userSchema);
const Book = mongoose.model('Book', bookSchema);

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/bookreader', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('Connected to MongoDB successfully');
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// JWT Secret
const JWT_SECRET = '123456789'; // In production, use environment variable

// Middleware to verify JWT token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findOne({ _id: decoded.userId });

        if (!user) {
            throw new Error();
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Please authenticate' });
    }
};

// Routes
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = new User({
            name,
            email,
            password: hashedPassword
        });

        // Save user to database
        await user.save();

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Error signing in' });
    }
});

app.post('/api/books', auth, upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'bookFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, genre, description } = req.body;
        const coverImage = req.files?.coverImage?.[0];
        const bookFile = req.files?.bookFile?.[0];

        const book = new Book({
            title,
            genre,
            description,
            author: req.user._id,
            coverImage: coverImage ? `/uploads/covers/${coverImage.filename}` : null,
            bookFile: bookFile ? `/uploads/books/${bookFile.filename}` : null
        });

        await book.save();
        res.status(201).json(book);
    } catch (error) {
        console.error('Error publishing book:', error);
        res.status(500).json({ message: 'Error publishing book' });
    }
});

app.get('/api/books', async (req, res) => {
    try {
        const books = await Book.find().populate('author', 'name');
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching books' });
    }
});

app.get('/api/books/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).populate('author', 'name');
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.json(book);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching book' });
    }
});

// User profile endpoints
app.get('/api/auth/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user data' });
    }
});

app.post('/api/auth/upload-photo', auth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No photo uploaded' });
        }

        const user = await User.findById(req.user._id);
        user.profilePhoto = `/uploads/profiles/${req.file.filename}`;
        await user.save();

        res.json({ photoUrl: user.profilePhoto });
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ message: 'Error uploading photo' });
    }
});

// Book management endpoints
app.get('/api/books/my-books', auth, async (req, res) => {
    try {
        // Get the user ID from the authenticated request
        const userId = req.user._id;
        
        // Find books where the author matches the user's ID
        const books = await Book.find({ author: userId })
            .populate('author', 'name')
            .sort({ createdAt: -1 });
            
        res.json(books);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ message: 'Error fetching books' });
    }
});

// Delete a book
app.delete('/api/books/:id', auth, async (req, res) => {
    try {
        const book = await Book.findOne({ _id: req.params.id, author: req.user._id });
        
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        // Delete associated files if they exist
        if (book.coverImage) {
            const coverPath = path.join(__dirname, book.coverImage);
            if (fs.existsSync(coverPath)) {
                fs.unlinkSync(coverPath);
            }
        }

        if (book.bookFile) {
            const bookPath = path.join(__dirname, book.bookFile);
            if (fs.existsSync(bookPath)) {
                fs.unlinkSync(bookPath);
            }
        }

        await Book.deleteOne({ _id: req.params.id });
        res.json({ message: 'Book deleted successfully' });
    } catch (error) {
        console.error('Error deleting book:', error);
        res.status(500).json({ message: 'Error deleting book' });
    }
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/signin', (req, res) => {
    res.sendFile(path.join(__dirname, 'signin.html'));
});

app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'search.html'));
});

app.get('/publish', (req, res) => {
    res.sendFile(path.join(__dirname, 'publish.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
}); 