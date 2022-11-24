const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express()
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gyop3ad.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    console.log('token', req.headers.authorization);
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        const appointMentOptionsCollection = client.db('hairsallon').collection('appointmentOptions')
        const bookingsCollection = client.db('hairsallon').collection('bookings');
        const usersCollection = client.db('hairsallon').collection('users');
        const adminCollection = client.db('hairsallon').collection('admin');

        //Node: make sure you use verifyAdmin after verifyJWT
        const verifyAdmin = (req, res, next) => {
            console.log('inside verifyadmin', req.decoded.email);
            next();

        }


        // Use aggregate to query multiple collection and then merge data
        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            console.log(date);
            const query = {};
            const options = await appointMentOptionsCollection.find(query).toArray();

            //get the bookings of the provided data
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

            // code carefully :D
            options.forEach(option => {
                const optionsBooked = alreadyBooked.filter(book => book.treatment === option.name);
                const bookedSlots = optionsBooked.map(book => book.slot);
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
                console.log(date, option.name, remainingSlots.length);
            })
            res.send(options);
        });

        app.get('/v2/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const options = await appointMentOptionsCollection.aggregate([
                {
                    $lookup: {
                        from: 'bookings',
                        localField: 'name',
                        foreignField: 'service',
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$appointmentDate', date]
                                    }
                                }
                            }
                        ],
                        as: 'booked'
                    }
                },
                {
                    $project: {
                        name: 1,
                        slots: 1,
                        booked: {
                            $map: {
