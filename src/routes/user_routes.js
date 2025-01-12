import { Router } from "express"
import { UserModel, TimeSheetModel } from "../db.js"
import bcrypt from 'bcrypt'
import e_auth from '../middleware/e_auth.js'
import {validationResult } from 'express-validator';
import {newUserValidate} from "../middleware/validations.js";


const router = Router()

// View all users (Admin only ( For Admin to select user to delete from list) +  Read Employee timesheet info)
router.get('/',e_auth, async (req, res) => {
    res.send(await UserModel.find({}))
})


// create user (Admin only)
router.post('/', e_auth, newUserValidate, async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const newUser = new UserModel({
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            admin: req.body.admin
        });

        const savedUser = await newUser.save();

        res.status(201).send({
            id: savedUser._id,
            name: savedUser.name,
            email: savedUser.email,
            password: savedUser.password
        });
    } catch (err) {
        res.status(400).send({ err: err.message });
    }
});

// read 1 user  (Admin and owner only)

router.get('/:id',e_auth, async (req, res) => {
    const user = await UserModel.findById(req.params.id)
    if (user) {
        res.send(user)
    } else{
        res.status(400).send({ 'Error': 'User not found'})
    }
})

// update (owner only) - (Update pword when created or other details - cant change admin status)

router.put('/:id', e_auth, async (req, res) => {

    const user = await UserModel.findById(req.params.id)
    const hashedPassword = await bcrypt.hash(req.body.password,10)
    


    if (user) {
        const updatedUser = await UserModel.findByIdAndUpdate(req.params.id,
            {   
                id: req.body._id,
                name: req.body.name,
                email: req.body.email,
                password: hashedPassword,
                admin: req.body.admin
            },
            {new:true}
            )
        res.send(updatedUser)
    } else{
        res.status(400).send({ 'Error': 'User not found'})
    }
})

//delete  (Admin only) - 

router.delete('/:id', async (req, res) => {
    const user = await UserModel.findById(req.params.id)
    if(user && user.admin === true){
        res.status(403).send({message: 'Unable to delete admin'})}
    
    else if (user) {
        await UserModel.findByIdAndDelete(req.params.id)
        res.send(user) // Should we make it send back a message??
    } else{
        res.status(400).send({ 'Error': 'User not found'})
    }
})

// Clock in
router.post('/clock-in', e_auth, async (req, res) => {
    try {
      // Extract user ID from request object
      const userId = req.user._id;
  
      // Create a new timesheet entry for clocking in
      const newTimeSheetEntry = new TimeSheetModel({
        user: userId, // Store the user ID
        clockIn: new Date(), // Use the current date/time as the clock-in time
      });
  
      // Save the timesheet entry to the database
      await newTimeSheetEntry.save();
  
      // Respond with success message
      res.status(201).json({ message: 'Clock in successful' });
    } catch (error) {
      // Respond with error message
      console.error(error);
      res.status(500).json({ error: 'Failed to clock in' });
    }
  });
  
  // Clock out
  router.post('/clock-out', e_auth, async (req, res) => {
    try {
      // Extract user ID from request object
      const userId = req.user._id;
  
      // Find the latest timesheet entry for the user
      const latestTimeSheetEntry = await TimeSheetModel.findOne({ user: userId }).sort({ createdAt: -1 });
  
      if (!latestTimeSheetEntry) {
        return res.status(400).json({ error: 'No active timesheet found' });
      }
  
      // Update the latest timesheet entry with the clock-out timestamp
      latestTimeSheetEntry.clockOut = new Date();
      await latestTimeSheetEntry.save();
  
      // Respond with success message
      res.status(200).json({ message: 'Clock out successful' });
    } catch (error) {
      // Respond with error message
      console.error(error);
      res.status(500).json({ error: 'Failed to clock out' });
    }
  });

// Function to calculate total time worked
function calculateTotalTime(clockIns, clockOuts) {
    // Ensure clock-in and clock-out arrays have the same length
    if (clockIns.length !== clockOuts.length) {
        throw new Error('Mismatched clock-in and clock-out timestamps');
    }

    // Initialize total time worked
    let totalTime = 0;

    // Calculate total time worked for each pair of clock-in and clock-out timestamps
    for (let i = 0; i < clockIns.length; i++) {
        const clockInTime = new Date(clockIns[i]);
        const clockOutTime = new Date(clockOuts[i]);
        totalTime += clockOutTime - clockInTime; // Add the time difference to total time
    }

    // Convert total time to hours (assuming milliseconds)
    return totalTime / (1000 * 60 * 60);
}
export default router