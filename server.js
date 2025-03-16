const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 8000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store active games
const games = {};

io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);
    socket.on('joingame', (gameId) => {
        if (games[gameId] && games[gameId].playerIds.length < 2) {
            games[gameId].playerIds.push(socket.id);
            socket.join(gameId);
            socket.emit('joingame', { gameId, state: games[gameId] });
        } else {
            socket.emit('error', 'Game not found');
        }
    });

    socket.on('resetgame', (gameId) => {
        if (games[gameId]) {
            io.to(gameId).emit('resetgame', gameId);
        }
    })

    socket.on('syncstates', ({ gameId, state }) => {
        if (games[gameId]) {
            games[gameId] = state;
            io.to(gameId).emit('syncstates', { gameId, state });
        }
    })

    socket.on('updatecell', ({ gameId, state }) => {
        if (games[gameId]) {
            games[gameId] = state;
            socket.to(gameId).emit('updatecell', { gameId, state });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        Object.keys(games).forEach((gameId) => {
            games[gameId].playerIds = games[gameId].playerIds.filter(id => id !== socket.id);
        });
    });
});

app.get('/', (req, res) => {
    const gameId = uuidv4();
    games[gameId] = { playerIds: [], newGame: true }
    res.redirect('/game/' + gameId)
});

app.get('/game/:gameId', (req, res) => {
    if (games[req.params.gameId]) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(400).send('Game Not Found')
    }
})

// Close all sockets
app.get('/closeSockets', (req, res) => {
    io.sockets.sockets.forEach((socket) => {
        socket.disconnect(true);
    });
    res.send('All sockets disconnected');
});
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
