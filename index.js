import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import axios from "axios";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import flash from "connect-flash";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(flash());

// Passport MUST come before the "Global variables middleware"
app.use(passport.initialize());
app.use(passport.session());

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  res.locals.error = req.flash('error');
  next();
});

// Authentication middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error", "Please log in to view that resource");
  res.redirect("/login");
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

function sortLocalBooks(books, sort) {
  const sorted = [...books]; // do NOT mutate original array

  if (sort === "rating") {
    sorted.sort((a, b) => b.rating - a.rating);
  } else if (sort === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // default: date_read DESC
    sorted.sort((a, b) => new Date(b.date_read) - new Date(a.date_read));
  }

  return sorted;
}

async function getCoverFromOpenLibrary(title, author) {
  // The Covers API doesn’t technically need Axios, but it’s a lot easier to use.
  try {
    const response = await axios.get(
      "https://openlibrary.org/search.json",
      {
        params: {
          title: title,
          author: author,
          limit: 1,
        },
      }
    );

    const book = response.data.docs[0];

    if (!book) return "/images/IMG_1644.JPEG";

    // Priority: ISBN → cover_i → fallback
    if (book.isbn && book.isbn.length > 0) {
      return `https://covers.openlibrary.org/b/isbn/${book.isbn[0]}-L.jpg`;
    }

    if (book.cover_i) {
      return `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`;
    }

    return "/images/IMG_1644.JPEG";
  } catch (err) {
    console.log("Open Library API err:", err.message);
    return "/images/IMG_1644.JPEG";
  }
}

// Landing page - redirect based on auth status
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/book-tracker");
  } else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/book-tracker",
  passport.authenticate("google", {
    successRedirect: "/book-tracker",
    failureRedirect: "/login",
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/book-tracker",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      req.flash("error", "Email already registered. Please log in.");
      res.redirect("/register");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            req.flash("success", "You are now registered and logged in");
            res.redirect("/book-tracker");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
    req.flash("error", "Something went wrong during registration.");
    res.redirect("/register");
  }
});

app.get("/book-tracker", ensureAuthenticated, async (req, res) => {
  let sort = req.query.sort;
  let booksToShow = []
  try {
    let orderBy = "date_read DESC";

    if (sort === "rating") orderBy = "rating DESC";
    if (sort === "title") orderBy = "title ASC";

    const userId = req.user.id;
    const result = await db.query("SELECT * FROM books WHERE user_id = $1 ORDER BY " + orderBy, [userId]);

    booksToShow = result.rows;
  } catch (err) {
    console.log(err)
    booksToShow = [];
  }
  res.render("index.ejs", { books: booksToShow, currentSort: sort });
});

app.get("/add", ensureAuthenticated, (req, res) => {
  res.render("add.ejs");
});

app.post("/add", ensureAuthenticated, async (req, res) => {
  try {
    let { title, author, notes, rating, date_read, cover_url } = req.body

    cover_url = await getCoverFromOpenLibrary(title, author);

    const result = await db.query(
      "INSERT INTO books (title, author, notes, rating, date_read, cover_url, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [title, author, notes, rating, date_read, cover_url, req.user.id]
    );
    req.flash("success", "Book added successfully!");
  } catch (err) {
    console.log(err)
    req.flash("error", "Could not add book. Please try again.");
  }
  res.redirect("/book-tracker");
});

app.get("/book/:id", ensureAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.query("SELECT * FROM books WHERE id = $1 AND user_id = $2", [id, req.user.id]);

    if (result.rows.length > 0) {
      res.render("book.ejs", { book: result.rows[0] });
    } else {
      res.redirect("/book-tracker");
    }
  } catch (err) {
    console.log(err);
    res.redirect("/book-tracker");
  }
});

app.get("/edit/:id", ensureAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;

    const result = await db.query("SELECT * FROM books WHERE id = $1 AND user_id = $2", [id, req.user.id]);

    if (result.rows.length > 0) {
      res.render("edit.ejs", { book: result.rows[0] });
    } else {
      res.redirect("/book-tracker");
    }
  } catch (err) {
    console.log(err);
    res.redirect("/book-tracker");
  }
});

app.post("/edit/:id", ensureAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    const { title, author, notes, rating, date_read, cover_url } = req.body;

    await db.query(
      "UPDATE books SET title = $1, author = $2, notes = $3, rating = $4, date_read = $5, cover_url = $6 WHERE id = $7 AND user_id = $8",
      [title, author, notes, rating, date_read, cover_url, id, req.user.id]
    );
    req.flash("success", "Book updated successfully!");
  } catch (err) {
    console.log(err);
    req.flash("error", "Could not update book.");
  }
  res.redirect("/book-tracker");
});

app.post("/delete/:id", ensureAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.query("DELETE FROM books WHERE id = $1 AND user_id = $2", [id, req.user.id]);
    req.flash("success", "Book deleted successfully!");
  } catch (err) {
    console.log(err);
    req.flash("error", "Could not delete book.");
  }
  res.redirect("/book-tracker");
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            //Error with password check
            console.error("Error comparing passwords:", err);
            return cb(null, false, { message: "Error comparing passwords: " + err });
          } else {
            if (valid) {
              //Passed password check
              return cb(null, user);
            } else {
              //Did not pass password check
              return cb(null, false, { message: "Incorrect password." });
            }
          }
        });
      } else {
        return cb(null, false, { message: "User not found." });
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/book-tracker",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        console.log(profile);
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(null, false, { message: "Error: " + err });
      }
    }
  )
)

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

let books = [
  {
    id: 1,
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    notes: "It's good",
    rating: 5,
    date_read: "2024-01-06",
    cover_url: "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1553383690i/2657.jpg"
  },
  {
    id: 2,
    title: "1984",
    author: "George Orwell",
    notes: "It's bad",
    rating: 3.75,
    date_read: "2024-01-10",
    cover_url: "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1657781256i/61439040.jpg"
  },
  {
    id: 3,
    title: "The Diary of a Young Girl",
    author: "Anne Frank",
    notes: "It's good. Discovered in the attic where she spent the final years of her life, Anne Frank’s Diary has become a timeless classic; a powerful reminder of the horrors of war and a moving testament to the resilience of the human spirit.",
    rating: 3.5,
    date_read: "2024-01-01",
    cover_url: "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1560816565i/48855.jpg"
  },
]