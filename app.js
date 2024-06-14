const express = require('express')
const bodyParser = require('body-parser')
const sql = require('mssql')
const path = require('path')
const bcrypt = require('bcryptjs')
const session = require('express-session');
const { error } = require('console')

const app = express();

app.set('view engine','ejs');
app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static(path.join(__dirname, 'public')))

const dbConfig = {
    user: 'sa',
    password: '123456',
    server: 'localhost',
    database: 'Libary_db',
    synchronize: true,
    options: {
        trustServerCertificate: true,
    }
}

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // nếu sử dụng HTTPS, hãy đặt secure: true
}));

sql.connect(dbConfig, err => {
    if (err) console.log(err)
    else console.log('Database connected')
})

app.get('/', (req,res) =>{
    res.render('index')
})

app.get('/register', (req,res) => {
    res.render('register');
})
app.post('/register', (req,res) => {
    const {full_name, username, phone, password, role} = req.body
    const request = new sql.Request()
    request.input('username', sql.VarChar, username);
    request.query(`SELECT * FROM users WHERE username = @username`, (err, results) => {
        if (err) console.log(err);

        if (results.recordset.length > 0) {
            return res.send('Username already exists');
        }

        else {
            request.input('full_name', sql.NVarChar, full_name)
            request.input('phone', sql.VarChar, phone)
            request.input('password', sql.VarChar, password)
            request.input('role', sql.VarChar, role)
            request.query(`Insert into users (full_name,phone,username,password,role) values (@full_name,@phone,@username,@password,@role)`, (err,result) => {
                if (err) console.log(err)
                res.redirect('/')
            })
        }
    });
})

app.get('/login', (req,res)=> {
    res.render('login')
})

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const request = new sql.Request();
    request.input('username', sql.VarChar, username);
    request.query(`SELECT * FROM users WHERE username = @username`, (err, results) => {
        if (err) console.log(err);
        if (results.recordset.length === 0) {
            return res.send('User not found');
        }

        const user = results.recordset[0];

        if (password != user.password) {
            return res.send('Invalid password');
        }
        req.session.user = user
        res.render('dashboard',{user})
    });
});

app.get('/dashboard',(req,res) => {
    const user = req.session.user
    res.render('dashboard',{user})
})

app.get('/logout',(req,res) => {
    req.session.destroy();
    res.redirect('/')
})

app.get('/manage-book',async (req,res) =>{
    const request = new sql.Request()
    const result = await request.query('Select * from books');
    const books = result.recordset;
    res.render('manage-book',{ books })
})

app.get('/add-book',(req,res)=> {
    res.render('add-book')
})

app.post('/add-book',async (req,res)=>{
    const { id, title ,author,theloai,published_date } = req.body
    const request = new sql.Request()
    request.input('id',sql.VarChar, id)
    request.input('title',sql.NVarChar, title)
    request.input('author',sql.NVarChar,author)
    request.input('theloai',sql.NVarChar,theloai)
    request.input('published_date',sql.Date,published_date)
    request.query(`insert into books (id,title,author,theloai,published_date,status) values (@id,@title,@author,@theloai,@published_date,'chua duoc muon')`,(err,result) => {
        if(err){
            console.log('loi chua duoc them')
            console.log(err)
        }
        res.redirect('/manage-book')
    })
})

app.get('/edit-book/:id',(req,res) => {
    const {id} = req.params
    const request = new sql.Request();
    request.input('id',sql.VarChar, id)
    request.query(`SELECT * FROM books WHERE id = @id`, (err,result) => {
        if(err) console.log(err);
        res.render('edit-book',{book: result.recordset[0]})
    })
})

app.post('/edit-book/:id', (req, res) => {
    const { id } = req.params;
    const { title, author, theloai, published_date } = req.body;
    const request = new sql.Request();
    request.input('id',sql.VarChar, id)
    request.input('title',sql.NVarChar, title)
    request.input('author',sql.NVarChar,author)
    request.input('theloai',sql.NVarChar,theloai)
    request.input('published_date',sql.Date,published_date)
    request.query(`UPDATE books SET title = @title, author = @author, theloai = @theloai, published_date = @published_date WHERE id = @id`, (err, result) => {
        if (err) console.log(err);
        res.redirect('/manage-book');
    });
});
app.get('/delete-book/:id', (req, res) => {
    const { id } = req.params;
    const request = new sql.Request();
    request.input('id', sql.VarChar, id);
    request.query(`DELETE FROM borrow_records WHERE book_id = @id`, (err,result)=> {
        if (err) console.log(err);
        const request1 = new sql.Request();
        request1.input('id', sql.VarChar, id);
        request1.query(`DELETE FROM books WHERE id = @id`, (err, result) => {
            if (err) console.log(err);
            res.redirect('/manage-book');
        });
    })
});

app.get('/manage-users', async (req, res) => {
    try {
        const request = new sql.Request();
        request.input('role',sql.VarChar,'bandoc')
        const result = await request.query('SELECT * FROM users where role = @role');
        const users = result.recordset;
        res.render('manage-users', { users });
    } catch (error) {
        console.error('Error getting users', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/search-users', (req, res) => {
    const { query } = req.query;
    const request = new sql.Request();
    request.input('query', sql.NVarChar, `%${query}%`);
    request.query(`SELECT * FROM users WHERE full_name LIKE @query OR username LIKE @query`, (err, results) => {
        if (err) console.log(err);
        res.render('manage-users', { users: results.recordset });
    });
});
app.get('/delete-user/:username', (req, res) => {
    const { username } = req.params;
    const request = new sql.Request();
    request.input('username', sql.VarChar, username);
    request.query(`SELECT book_id FROM borrow_records WHERE user_id = @username AND return_date IS NULL`, (err, result) => {
        if (err) console.log(err);

        result.recordset.forEach(record => {
            const bookId = record.book_id;
            const Bookrequest = new sql.Request();
            Bookrequest.input('bookId',sql.VarChar,bookId)
            Bookrequest.query(`UPDATE books SET status = 'Chua duoc muon' WHERE id = @bookId`, (err, result) => {
                if (err) console.log(err);
            });
        });
        const borrowrequest = new sql.Request();
        borrowrequest.input('username',sql.VarChar,username)
        borrowrequest.query(`DELETE FROM borrow_records WHERE user_id = @username`, (err, result) => {
            if (err) console.log(err);
            const userrequest = new sql.Request();
            userrequest.input('username', sql.VarChar, username);
            userrequest.query(`DELETE FROM users WHERE username = @username`, (err, result) => {
                if (err) console.log(err);
                res.redirect('/manage-users');
            });
        });
    });
});

app.get('/search-books/:username', (req, res) => {
    const { username } = req.params;
    const { query } = req.query;

    const userRequest = new sql.Request();
    userRequest.input('username', sql.VarChar, username);
    userRequest.query(`SELECT * FROM users WHERE username = @username`, (err, userResult) => {

        const bookRequest = new sql.Request();

        bookRequest.input('query', sql.NVarChar, `%${query}%`);
        bookRequest.query(`SELECT * FROM books WHERE author LIKE @query OR theloai LIKE @query OR title LIKE @query OR id LIKE @query`, (err, bookResults) => {
            res.render('borrow-book', { user: userResult.recordset[0], books: bookResults.recordset, query });
        });
    });
});

app.get('/view-br-book', (req, res) => {
    const request = new sql.Request();

    let sqlQuery = `
        SELECT borrow_records.user_id, books.id, books.title, books.author, books.theloai AS genre, borrow_records.borrow_date, borrow_records.return_date,borrow_records.status
        FROM borrow_records
        JOIN books ON borrow_records.book_id = books.id
    `;


    request.query(sqlQuery, (err, result) => {
        res.render('view-br-book', { borrows: result.recordset });
    });
});

app.get('/search-br',(req,res) => {
    const { user_id, book_id } = req.query;

    const request = new sql.Request();
    request.input('user_id', sql.VarChar, user_id);
    request.input('book_id', sql.VarChar, book_id);
    request.query(`
            SELECT borrow_records.user_id, books.id, books.title, books.author, books.theloai AS genre, borrow_records.borrow_date, borrow_records.return_date
            FROM borrow_records
            JOIN books ON borrow_records.book_id = books.id
            WHERE borrow_records.user_id = @user_id OR books.id = @book_id
        `,(err,result) => {
            console.error('SQL query error:', err);
            res.render('view-br-book',{borrows: result.recordset})
        })
})

app.get('/borrow-book/:username', (req, res) => {
    
    const {username} = req.params
    const request = new sql.Request();
    request.input('username',sql.VarChar, username)
    request.query(`SELECT * FROM users WHERE username = @username`, (err,result) => {
        if(err) console.log(err);
        const bookRequest = new sql.Request()
        bookRequest.query('SELECT * FROM books', (err, bookResult) => {
            const books = bookResult.recordset;
            res.render('borrow-book',{user: result.recordset[0],books})
        })
    })
});

app.post('/borrow-book/:username', (req, res) => {
    const {username} = req.params
    const { book_id } = req.body;

    const request = new sql.Request();
    request.input('book_id', sql.VarChar, book_id);
    request.input('status', sql.NVarChar, 'chua duoc muon');
    request.query('SELECT * FROM books WHERE id = @book_id AND status = @status', (err, results) => {
        if (err) console.log(err);
        if (results.recordset.length === 0) {
            return res.send('Sach da duoc muon truoc do');
        }

        const borrowRequest = new sql.Request();
        borrowRequest.input('book_id', sql.VarChar, book_id);
        borrowRequest.input('user_id', sql.VarChar, username);
        borrowRequest.query(`INSERT INTO borrow_records (book_id, user_id, borrow_date, status) VALUES (@book_id, @user_id, GETDATE(), 'dang muon')`, (err, result) => {
            if (err) console.log(err);

            const updateRequest = new sql.Request();
            updateRequest.input('status', sql.NVarChar, 'da duoc muon');
            updateRequest.input('book_id', sql.VarChar, book_id);
            updateRequest.query('UPDATE books SET status = @status WHERE id = @book_id', (err, result) => {
                if (err) console.log(err);
                res.send('Mượn thành công')
            });
        });
    });
});

app.get('/return-book/:username', (req, res) => {
    const { username } = req.params;

    const userRequest = new sql.Request();
    userRequest.input('username', sql.VarChar, username);
    userRequest.query('SELECT * FROM users WHERE username = @username', (err, userResult) => {

        const bookRequest = new sql.Request();
        bookRequest.input('username', sql.VarChar, username);
        bookRequest.query(`SELECT books.id AS book_id, books.title, books.author, books.theloai, books.published_date, books.status, borrow_records.borrow_date
                           FROM borrow_records 
                           INNER JOIN books ON borrow_records.book_id = books.id 
                           WHERE borrow_records.user_id = @username AND borrow_records.status = 'dang muon'`, (err, bookResult) => {

            res.render('return-book', { user: userResult.recordset[0], borrowedBooks: bookResult.recordset });
        });
    });
});
app.post('/return-book/:username', (req, res) => {
    const { book_id } = req.body;
    const { username } = req.params;

    const updateRequest = new sql.Request();
    updateRequest.input('status', sql.VarChar, 'Chua duoc muon');
    updateRequest.input('book_id', sql.VarChar, book_id);
    updateRequest.query('UPDATE books SET status = @status WHERE id = @book_id', (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).send('Internal Server Error');
        }

        const returnRequest = new sql.Request();
        returnRequest.input('status', sql.NVarChar, 'Da tra');
        returnRequest.input('book_id', sql.VarChar, book_id);
        returnRequest.input('user_id', sql.VarChar, username);
        returnRequest.query('UPDATE borrow_records SET status = @status, return_date = GETDATE() WHERE book_id = @book_id AND user_id = @user_id AND status = \'dang muon\'', (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).send('Internal Server Error');
            }
            res.send('Trả sách thành công');
        });
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000')
})

