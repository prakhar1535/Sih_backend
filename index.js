const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = express();
const cors = require("cors");
app.use(express.json());
app.use(cors())
const multer = require('multer');

// Set up multer storage
const storage = multer.memoryStorage(); // Store files in memory as buffers

const upload = multer({
    storage: storage,
    limits: {
      fileSize: 1024 * 1024 * 15 // for 5MB
    }
  }).single('content');
  
//database connection and schemas
mongoose.connect('mongodb+srv://ksaksham39:StudySyncSyncSync@cluster0.0mahhjk.mongodb.net/', { dbName: "StudySyncDataBase" });

const db = mongoose.connection
db.on('error', (error) => console.log('MongoDb connection errror ', error));
db.once('open', () => console.log("Connected to database"))

//schemas
//collegeSchema

const collegeSchema = new mongoose.Schema({
    name: String,
    pincode: {
        type: Number,
        required: true,
        unique: true,
    },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Courses" }]
})
//CourseSchema
const courseSchema = new mongoose.Schema({
    name: String,
});
//TeacherSchema
const teacherSchema = new mongoose.Schema({
    name: String,
    college: { type: mongoose.Schema.Types.ObjectId, ref: "Colleges" },
    dept: { type: mongoose.Schema.Types.ObjectId, ref: "Courses" },
    contactNumber: Number,
    email: String,
    password: String,
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Classes" }],
    projectsRecieved: [{ type: mongoose.Schema.Types.ObjectId, ref: "Projects" }]

})
//student schema
const studentSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    collegeDetails: {
        enrollmentNumber: Number,
        collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "Colleges" },
        courseEnrolled: { type: mongoose.Schema.Types.ObjectId, ref: "Courses" },//particular course
    },
    classesJoined: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Classes',
        },
    ],
    projectsUploaded: [{ type: mongoose.Schema.Types.ObjectId, ref: "Projects" }]

})
//classes schema
const classesSchema = new mongoose.Schema({
    nameOfClass: {
        type: String
    },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teachers" },//jo req.teacher se aayegi
    students: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Students',
        },
    ],
    dateCreated: String,
    // classCode: String,
    inviteTokens: //either students manually enter or automate it(V.hard)
    {
        type: String,
    },

})
//course schema
//projectsSchema


const projectSchema = new mongoose.Schema({
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teachers',
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Students',
    },
    isPlagiarized: {
      type: Boolean,
    },
    isApproved: {
      type: Boolean,
    },
    tags: [String], 
 
    content: {
      type: Buffer,//binary data-->buffer
    },
  });

//Bhaii .... Creating models for college,courses,teacher,student,classes,project,


const Teachers = mongoose.model('Teachers', teacherSchema);
const Students = mongoose.model('Students', studentSchema);
const Colleges = mongoose.model('Colleges', collegeSchema);
const Courses = mongoose.model("Courses", courseSchema)
const Classes = mongoose.model("Classes", classesSchema);
const Projects = mongoose.model("Projects", projectSchema);


//Leh bhai authentication
const SECRETFORTEACHER = "gaddiRokega"
const SECRETFORSTUDENT = "aslaHumBhiRakhteHaiPehalwan"
const authenticateJwtTeacher = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const tokenforteacher = authHeader.split(' ')[1];
        jwt.verify(tokenforteacher, SECRETFORTEACHER, (err, teacher) => {
            if (err) {
                console.log("error")
                return res.sendStatus(403);
            }
            console.log(teacher)
            req.teacher = teacher.teacher;//teacher ki mongodb id 
            console.log("next")
            next();
        });
    } else {
        res.sendStatus(401);
    }
};
const authenticateJwtStudent = (req, res, next) => {
    // console.log("hello");
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const tokenforstudent = authHeader.split(' ')[1];
        jwt.verify(tokenforstudent, SECRETFORSTUDENT, (err, student) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.student = student.student;//student ki mongodb id 
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

//Routes 
//send all available colleges
app.get("/allColleges",async(req,res)=>{
    let colleges=await Colleges.find({});
    // console.log(colleges);
    res.json({message:'List of all colleges',colleges})
})
//send all available departments
app.get("/alldepartments",async(req,res)=>{
    let courses=await Courses.find({});
    // console.log(colleges);
    res.json({message:'List of all courses',courses})
})
app.get("/allTeachers",async(req,res)=>{
    let teachers=await Teachers.find({});
    // console.log(colleges);
    res.json({message:'List of all teachers',teachers})
})
//teacher signup
app.post("/teacher/signup", async (req, res) => {
    const { name, password, college, email, dept, contactNumber } = req.body;
    //college and dept will be fetched, so there will be kinda like a /me route to get all colleges and dept and then we will have their particular id's
    const teacher = await Teachers.findOne({ email })//email should be different for all teacher
    if (teacher) {
        res.status(403).send({ message: "Teacher already exists" })
    } else {
        const newTeacher = new Teachers({ name, password, email, college, dept, contactNumber, classes: [], projectsRecieved: [] });
        await newTeacher.save();
        const token = jwt.sign({ teacher: newTeacher._id }, SECRETFORTEACHER, { expiresIn: '1h' });
        res.json({ message: 'Teacher created successfully', token });
    }

})
//teacher signin
app.post("/teacher/login", async (req, res) => {
    const { name, password, email } = req.body
    const teacher = await Teachers.findOne({ name, password, email }).populate("college")
    if (teacher) {
        const token = jwt.sign({ teacher: teacher._id }, SECRETFORTEACHER, { expiresIn: '1h' });
        res.json({ message: "Logged In Successfully", token ,college:teacher.college})
    } else {
        res.status(403).json({ message: 'Teacher not found' });
    }
})

//teacher create class
app.post("/teacher/createclass", authenticateJwtTeacher, async (req, res) => {
    const { nameOfClass } = req.body;
    const teacher = req.teacher
    if (!nameOfClass) {
        return res.status(500).send("Please enter the details")
    };
    const inviteTokens = `${Math.round(Math.random() * 100)}`
    let dateCreated = `${new Date()}`
    const newClass = new Classes({ nameOfClass, teacher, dateCreated, students: [], inviteTokens })


    await newClass.save();
    const updatedTeacher = await Teachers.findByIdAndUpdate(teacher, { $push: { classes: newClass._id } }, { new: true })
    res.status(200).json({ message: "Class Created Successfully", inviteTokens })

})
app.get("/teacher/me", authenticateJwtTeacher, async (req, res) => {
    const teacher = await Teachers.findById(req.teacher).populate("classes").populate("college").populate("dept")
    if (teacher) {

        res.status(200).json(teacher)

    } else {
        res.status(400).json({ message: "Teacher Not Found" })
    }
})
app.get("/teacher/getclasses", authenticateJwtTeacher, async (req, res) => {
    const teacherId = req.teacher
    const classes = await Classes.find({ teacher: teacherId }).populate("students").populate("teacher");
    console.log(classes);
    if (!classes) {
        res.status(409).send('No Classes Found')
    } else {
        res.status(200).json(classes);
    }

})
app.get("/teacher/getclasses/:classId",authenticateJwtTeacher,async(req,res)=>{
    let classId=req.params.classId;
    let foundClass = await Classes.findOne({_id:classId}).populate("students");
    if(foundClass){
        res.json({message:'Class Found',class:foundClass})
    }
    else{
        res.status(404).json({message:'No Class Found'})
    }
})
//teacher can see a particularr student in the class
app.get("/teacher/allClasses/student/:studentId",authenticateJwtTeacher,async (req,res)=>{
    let studentId=req.params.studentId;
    const student=await Students.findOne({_id:studentId}).populate("classesJoined").populate("projectsUploaded").populate("collegeDetails").populate({
        path: "projectsUploaded",
        select: "-content",
      });
    if(!student){
        res.status(404).json({message:'No Student Found'})
    }
    else{
        res.json({message:'Student Found',student})
    }
})
//teacher can see a particularr project of student 
app.get("/teacher/student/project/:projectId",authenticateJwtTeacher,async (req,res)=>{
    let projectId=req.params.projectId;
    const project=await Projects.findOne({_id:projectId}).populate("teacher").populate("student")
    if(!project){
        res.status(404).json({message:'No project Found'})
    }
    else{
        res.json({message:'project Found',project})
    }
})
//teacher creates project

/**const projectSchema = new mongoose.Schema({
    title: {
        type: String,
    },
    description: {
        type: String
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teachers'
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Students'
    },
    isPlagiarized: {
        type: Boolean,
    },
    isApproved: {
        type: Boolean,
    },
}) */
app.get("/student/me", authenticateJwtStudent, async (req, res) => {
    const student = await Students.findById(req.student)
  .populate("collegeDetails")
  .populate("classesJoined")
  .populate({
    path: "projectsUploaded",
    select: "-content",
  });

    if (student) {

        res.status(200).json(student)

    } else {
        res.status(400).json({ message: "student Not Found" })
    }
})
///student signs up
app.post("/student/signup", async (req, res) => {
    // collegeId and courseEnrolled will be ids 
    const { name, email, password, enrollmentNumber, collegeId, courseEnrolled } = req.body;
    const existingStudent = await Students.findOne({ email })//email should be unique;
    if (existingStudent) {
        res.status(403).json({ message: "Student already exists" })
    }
    else {
        const collegeDetails = {
            enrollmentNumber,
            collegeId,
            courseEnrolled
        }
        const newStudent = new Students({ name, email, password, collegeDetails, classesJoined: [], projectsUploaded: [] })
        await newStudent.save();
        const token = jwt.sign({ student: newStudent._id }, SECRETFORSTUDENT, { expiresIn: '1h' })
        res.status(200).json({ message: "Student Created Successfully", token })
    }

})

///student signs in
app.post("/student/login", async (req, res) => {
    const { name, email, password } = req.body;
    const student = await Students.findOne({ name, email, password }).populate("collegeDetails.collegeId");
    if (student) {
        const token = jwt.sign({ student: student._id }, SECRETFORSTUDENT, { expiresIn: '1h' });
        res.status(200).json({ message: "Logged In Successfully", token,college:student.collegeDetails.collegeId })
    }
    else {
        res.status(400).json({ message: "Cannot Find Student" })
    }
})

///student enters invite token and get details of the class
app.post("/student/getClass",authenticateJwtStudent,async(req,res)=>{
    const{inviteToken}= req.body;
    ///assuming the invite token will always be unique
    const availableClass= await Classes.findOne({inviteTokens:inviteToken}).populate("teacher").populate("students")
    if(availableClass){
  
        const resClass={
            _id:availableClass._id,
            nameOfClass:availableClass.nameOfClass,
            teacher: availableClass.teacher.name,
            dateCreated:availableClass.dateCreated,
            students:availableClass.students
        }
        res.json({message:"class found",resClass})
    }
    else{
        res.status(400).json({message:"No Class Found"})
    }
    
})
//student joins a class by providing class invitetoken
app.post("/student/joinClass",authenticateJwtStudent,async (req,res)=>{
    const{inviteToken}= req.body;
    const student = await Students.findById(req.student);
    // console.log(student);
    if(student){
        const foundClass= await Classes.findOne({inviteTokens:inviteToken});
        // console.log(foundClass);
        if(!foundClass){
            res.status(400).json({message:"No Class Found"})
        }else{
            const updatedClass = await Classes.findByIdAndUpdate(foundClass._id, { $push: { students: student._id } }, { new: true })
            const updatedStudent = await Students.findByIdAndUpdate(student._id, { $push: { classesJoined: foundClass._id } }, { new: true })
            res.json({message:"Class Joined Successfully"})
        }
    }else{
        res.status(400).json({message:"No Student Found"})
    }
})
app.post("/student/projects/upload", authenticateJwtStudent, upload, async (req, res) => {
    // req.file contains the uploaded file (PDF)
    // req.body contains other form data (title, description, etc.)
    const projectData = req.body;
    const updatedTags=projectData.tags.split(",")
    projectData.tags=updatedTags
    const studentHeader = req.headers.student;
    const teacherHeader = req.headers.teacher;
  
    const student = await Students.findById(req.student);
  
    if (student) {
      const project = {
        ...projectData, //project data contains tags also which is array of strings
        student: studentHeader,
        teacher: teacherHeader,
        isPlagiarized: true,
        isApproved: false,
        content: req.file.buffer, // Store the file content as a buffer
      };
  
      const newProject = new Projects(project);
      await newProject.save();
      const updatedStudent = await Students.findByIdAndUpdate(
        student._id,
        { $push: { projectsUploaded: newProject._id } },
        { new: true }
      );
  
      res.json({ message: 'Project Uploaded Successfully' });
    }
  });

  //SEARCH FOR A PARTICULAR PROJECT ON THE MAIN PORTAL
  app.post('/portal/seeProject',async(req,res)=>{
    const keyword = req.query.keyword.toLowerCase();
    const projects = await Projects.find({
        $or: [
          { title: { $regex: keyword, $options: 'i' } }, 
          { description: { $regex: keyword, $options: 'i' } }, 
          { tags: { $in: [keyword] } }, 
        ],
      }).select("-content")
      if(!projects){
        res.status(404).json('No Projects Found')
      }
      else{
        res.json(projects)
      }
      

    
  })

// const projectSchema = new mongoose.Schema({
//     title: {
//         type: String,
//     },
//     description: {
//         type: String
//     },
//     teacher: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Teachers'
//     },
//     student: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Students'
//     },
//     isPlagiarized: {
//         type: Boolean,
//     },
//     isApproved: {
//         type: Boolean,
//     },
// })








app.listen(3000, () => console.log('Server running on port 3000'));