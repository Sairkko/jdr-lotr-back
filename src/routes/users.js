import {getUserById, getUsers, loginUser, registerUser, sendVerificationEmail} from "../controllers/users.js";
import nodemailer from 'nodemailer';
import {v4 as uuidv4} from 'uuid';
import mjml2html from 'mjml';
import User from "../models/users.js";

export function usersRoutes(app) {
	app.post("/login", async (request, reply) => {
		reply.send(await loginUser(request.body, app));
	}).post(
		"/logout",
		{ preHandler: [app.authenticate] },
		async (request, reply) => {
			let blacklistedTokens = [];
			const token = request.headers["authorization"].split(" ")[1];

			blacklistedTokens.push(token);

			reply.send({ logout: true });
		}
	);

	app.post("/register", async (request, reply) => {
		try {
			const { firstname, lastname, email, username, password } = request.body;

			if (!firstname || !lastname || !email || !username || !password) {
				return reply.status(400).send({ success: false, message: 'Tous les champs sont requis' });
			}

			const user = await registerUser(request.body, app.bcrypt);

			const verificationToken = uuidv4();

			user.verificationToken = verificationToken;
			await user.save();

			const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;

			await sendVerificationEmail(user.email, verificationLink, user.firstname, user.lastname);

 			reply.send(user);

		} catch (error) {
			console.error('Erreur lors de l\'inscription:', error);
			reply.status(400).send({ success: false, message: 'Erreur lors de l\'inscription' });
		}
	});

	app.get("/verify-email", async (request, reply) => {
		const { token } = request.query;

		try {
			const user = await User.findOne({ where: { verificationToken: token } });

			if (!user) {
				return reply.status(400).send('Token invalide ou expiré');
			}

			user.verified = true;
			user.verificationToken = null;
			await user.save();

			reply.type('text/html').send(`
			<!DOCTYPE html>
			<html lang="fr">
				<head>
					<meta charset="UTF-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1.0" />
					<title>Email vérifié</title>
					<style>
						body {
							font-family: 'Arial', sans-serif;
							background-color: #f0f4f8;
							display: flex;
							justify-content: center;
							align-items: center;
							height: 100vh;
							margin: 0;
						}
						.container {
							background-color: white;
							padding: 40px;
							border-radius: 8px;
							box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
							text-align: center;
							max-width: 400px;
							width: 100%;
						}
						h1 {
							color: #4CAF50;
							font-size: 24px;
							margin-bottom: 20px;
						}
						p {
							color: #333;
							font-size: 16px;
							margin-bottom: 30px;
						}
						.button {
							display: inline-block;
							padding: 12px 24px;
							background-color: #4CAF50;
							color: white;
							border-radius: 5px;
							text-decoration: none;
							font-weight: bold;
							transition: background-color 0.3s ease;
						}
						.button:hover {
							background-color: #45a049;
						}
						.redirect {
							color: #888;
							margin-top: 20px;
						}
					</style>
				</head>
				<body>
					<div class="container">
						<h1>Email vérifié avec succès !</h1>
						<p>Votre email a bien été vérifié. Vous allez être redirigé vers la page de connexion.</p>
						<a href="http://localhost:5173/auth/login" class="button">Aller à la connexion</a>
						<p class="redirect">Redirection automatique dans 3 secondes...</p>
					</div>
					<script>
						setTimeout(function() {
							window.location.href = 'http://localhost:5173/auth/login';
						}, 3000);
					</script>
				</body>
			</html>
		`);
		} catch (error) {
			reply.status(500).send('Erreur lors de la vérification de l\'email');
		}
	});

	//récupération de la liste des utilisateurs
	app.get("/users", async (request, reply) => {
		reply.send(await getUsers());
	});
	//récupération d'un utilisateur par son id
	app.get("/users/:id", async (request, reply) => {
		reply.send(await getUserById(request.params.id));
	});
}

