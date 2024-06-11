const express = require('express');
const multer = require("multer");
const bodyparser = require("body-parser");
const encoder = bodyparser.urlencoded({extended:true});
const dotenv = require("dotenv");
const app=express();
const path = require("path");
const cookieParser = require("cookie-parser");
const ErrorHandler = require("./utils/ErrorHandler");
const catchAsyncErrors = require("./middleware/catchAsyncErrors");
const {isAuthenticatedUser,authorizeRoles} = require("./middleware/auth");
const {logout} = require("./controllers/userController");
const sendToken = require("./utils/jwtToken");
const fs = require("fs");
const uploadsDir = path.join(__dirname, "uploads");
const uploadsDir2 = path.join(__dirname, "uploads_blogs");
const sharp = require("sharp");
const dateTime = require("simple-datetime-formater");


const http = require("http").Server(app);


app.use(express.json());
app.use(cookieParser());
app.use(bodyparser.urlencoded({extended:true}));

app.use(express.static('public'));
const user = require('./routes/userRoute');
const Post = require("./models/postModel");
const User = require("./models/userModel");
// app.set('views',path.join(__dirname,'views'))
app.set('view engine', 'ejs')
//Config       
if(process.env.NODE_ENV !== "PRODUCTION"){
    require("dotenv").config({path:"config/config.env"});
} 





function generateThumbnail(filepath) {
    const thumbnailFilename = path.join(
      path.dirname(filepath),
      "thumbnails",
      path.basename(filepath)
    );
    return sharp(filepath)
      .resize(200, 200)
      .toFile(thumbnailFilename)
      .then(() => thumbnailFilename);
  }



app.get('/notes', function(req, res) {
    var query = req.query.q; // Get the search query from the URL parameters
    var files = getUploadedFiles(uploadsDir, query); // Filter the uploaded files by the search query
    res.render('sem_notes', { files: files });
  });
  
  function getUploadedFiles(uploadsDir, query) {
    var files = fs.readdirSync(uploadsDir); // Read the directory synchronously
    if (query) { // If there is a search query, filter the files by the query
      files = files.filter(function(file) {
        return file.toLowerCase().indexOf(query.toLowerCase()) !== -1; // Case-insensitive search
      });
    }
    return files.map(function(file) {
      return { filename: file, originalname: file };
    });
  }


app.use('/api/v1',user);
const mongoose = require('mongoose');

// configure multer middleware
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  });
  
  const storage2 = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads_blogs/");
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });

  const upload2 = multer({
    storage: storage2, // limit file size to 1 MB
      fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG images are allowed.'));
    }
  }
  });
  const upload = multer({
    storage: storage, // limit file size to 1 MB
   
  });

  const getAllPosts = async (req, res, next) => {
    try {
      const posts = await Post.find().sort({ createdAt: -1 });
      res.locals.posts = posts;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).send('Error fetching posts');
    }
  };
  
  app.get("/notes", function (req, res) {
    
    fs.readdir(uploadsDir, function (err, files) {
      if (err) {
        console.error("Error reading uploads directory:", err);
        files = []; // Set files to an empty array if an error occurred
      }
  
      res.render("sem_notes", {
        files: files.map(function (filename) {
          return {
            filename: filename,
            originalname: filename.replace(/.[^.]*$/, ""),
          };
        }),
      });
    });
  });

  app.post("/upload", function (req, res) {
    upload.single("fileToUpload")(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            res.status(500).send("An error occurred while uploading the file.");
          } else if (err) {
            res.status(500).send("An unknown error occurred while uploading the file.");
          } else {
            res.redirect("/notes");
          }
    });
  });
  
// serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads_blogs", express.static(path.join(__dirname, "uploads_blogs")));

// handle GET requests to /download/:filename
app.get("/download/:filename", function (req, res) {
    console.log(req.params.filename);
  const filePath = path.join(__dirname, "uploads/" + req.params.filename);
  res.download(filePath, function (err) {
    if (err) {
      res.status(404).send("File not found.");
    }
  });
});



// app.get("/carpooling",async (req, res,next) => {
//     res.render("carpooling");
// })
app.get("/",async (req, res,next) => {
    res.render("index");
})

app.post("/",getAllPosts,async (req,res,next) => {
    const enrollment_id = req.body.enrollment_id;
    const password = req.body.password;
    if(!enrollment_id || !password){
        return next(new ErrorHandler("Please Enter Email and Password",400))
    }

    const user =await User.findOne({enrollment_id}).select("+password");

    if(!user){
       
        return next(new ErrorHandler("Invalid Email or Password",401));

    }

    const isPasswordMatched =await user.comparePassword(password);

    if(!isPasswordMatched){
       
        return next(new ErrorHandler("Invalid Email or Password",401));

    }
    sendToken(user,201,res);
    res.render("home",{enrollment_id:enrollment_id,password:password});


})

app.get('/home',getAllPosts,isAuthenticatedUser ,(req,res) => {
    res.render('home');
})

app.get("/feed",isAuthenticatedUser,function(req,res){
  res.render("feed");
})
app.get("/profile",isAuthenticatedUser,function(req,res){
  res.render("profile");
})

app.get("/update_profile",isAuthenticatedUser,function(req,res){
  const user = req.user;
  res.render("profile",{user});
})
// app.post('/update-profile', (req, res) => {
//   const newProfileValues = {
//     profilePicture: req.body.picture,
//     profileName: req.body.name,
//     profileEmail: req.body.email,
//     profileId: req.body.id,
//     profileAge: req.body.age,
//     profileAddress: req.body.address
//   };
//   res.render('profile', newProfileValues);
// });


app.get('/blogs',getAllPosts, (req, res) => {
  res.render('blog');
});

app.post('/add', upload2.single('image'), (req, res) => {
  const { title, body,namee } = req.body;
  const post = new Post({ title, body,namee });
  if (req.file) {
    post.image = `/uploads_blogs/${req.file.filename}`;
  }
  post.save()
    .then(() => {
      res.redirect('/blogs');
    })
    .catch(err => {
      console.error(err);
      res.sendStatus(500);
    });
});


app.get("/logout",logout);
// app.listen(4005,()=>{
//     console.log("port 4000 is connected")
// })
// http.listen(5000, () => {
//   console.log("Running on Port: " + 4000);
// });

module.exports = app








