import User from "../models/users.js";
import { Op } from "sequelize";
import nodemailer from "nodemailer";
import mjml2html from "mjml";

async function generateID(id) {
	const { count } = await findAndCountAllUsersById(id);
	if (count > 0) {
		id = id.substring(0, 5);
		const { count } = await findAndCountAllUsersById(id);
		id = id + (count + 1);
	}
	return id;
}

export async function getUsers() {
	return await User.findAll();
}
export async function getUserById(id) {
	return await User.findByPk(id);
}
export async function findAndCountAllUsersById(id) {
	return await User.findAndCountAll({
		where: {
			id: {
				[Op.like]: `${id}%`,
			},
		},
	});
}
export async function findAndCountAllUsersByEmail(email) {
	return await User.findAndCountAll({
		where: {
			email: {
				[Op.eq]: email,
			},
		},
	});
}
export async function findAndCountAllUsersByUsername(username) {
	return await User.findAndCountAll({
		where: {
			username: {
				[Op.eq]: username,
			},
		},
	});
}
export async function registerUser(userDatas, bcrypt) {
	if (!userDatas) {
		return { error: "Aucune donnée à enregistrer" };
	}
	const { firstname, lastname, username, email, password } = userDatas;
	if (!firstname || !lastname || !username || !email || !password) {
		return { error: "Tous les champs sont obligatoires" };
	}
	//vérification que l'email n'est pas déjà utilisé
	const { count: emailCount } = await findAndCountAllUsersByEmail(email);
	if (emailCount > 0) {
		return { error: "L'adresse email est déjà utilisée." };
	}

	//vérification que le pseudo n'est pas déjà utilisé
	const { count: usernameCount } = await findAndCountAllUsersByUsername(
		username
	);
	if (usernameCount > 0) {
		return { error: "Le nom d'utilisateur est déjà utilisé." };
	}
	//création de l'identifiant
	let id = await generateID(
		(lastname.substring(0, 3) + firstname.substring(0, 3)).toUpperCase()
	);
	//hashage du mot de passe
	const hashedPassword = await bcrypt.hash(password);
	//création de l'utilisateur dans la base de données
	const user = {
		id,
		firstname,
		lastname,
		username,
		email,
		password: hashedPassword,
	};
	return await User.create(user);
}
export async function loginUser(userDatas, app) {
	if (!userDatas) {
		return { error: "Aucune donnée n'a été envoyée" };
	}
	const { email, password } = userDatas;
	if (!email || !password) {
		return { error: "Tous les champs sont obligatoires" };
	}
	//vérification que l'email est utilisé
	const { count, rows } = await findAndCountAllUsersByEmail(email);
	if (count === 0) {
		return {
			error: "Il n'y a pas d'utilisateur associé à cette adresse email.",
		};
	} else if (rows[0].verified === false) {
		return {
			error: "Votre compte n'est pas encore vérifié. Veuillez vérifier votre boîte mail.",
		};
	}
	//récupération de l'utilisateur
	const user = await User.findOne({
		where: {
			email: {
				[Op.eq]: email,
			},
		},
	});
	//comparaison des mots de passe
	const match = await app.bcrypt.compare(password, user.password);
	if (!match) {
		return { error: "Mot de passe incorrect" };
	}
	// Générer le JWT après une authentification réussie
	const token = app.jwt.sign(
		{ id: user.id, username: user.username },
		{ expiresIn: "3h" }
	);
	return { token };
}

export async function sendVerificationEmail (email, verificationLink, firstname, lastname) {
	const transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: 'bibidelfuegoo@gmail.com',
			pass: 'htvm nndn foaj aabe',
		},
	});

	const emailTemplate = mjml2html(`
		<mjml>
		  <mj-body background-color="#f4f4f4" font-family="Arial, sans-serif">
		    <mj-section background-color="#4CAF50" padding="20px">
		      <mj-column>
		        <mj-text font-size="24px" font-weight="bold" color="#ffffff" align="center">
		          Bienvenue ${firstname} ${lastname} !
		        </mj-text>
		        <mj-text font-size="16px" color="#ffffff" align="center">
		          Nous sommes ravis de vous compter parmi nous.
		        </mj-text>
		      </mj-column>
		    </mj-section>

		    <mj-section background-color="#ffffff" padding="20px">
		      <mj-column>
		        <mj-text font-size="20px" font-weight="bold" color="#000000" align="center">
		          Merci pour votre inscription à GOTY !
		        </mj-text>
		        <mj-text font-size="16px" color="#555555" align="center">
		          Pour finaliser votre inscription, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.
		        </mj-text>

		        <mj-button href="${verificationLink}" background-color="#4CAF50" color="white" padding="15px 25px" border-radius="5px" font-size="16px" font-weight="bold" align="center">
		          Vérifier mon email
		        </mj-button>

		        <mj-text font-size="14px" color="#555555" align="center" padding-top="20px">
		          Si vous n'avez pas demandé cette inscription, veuillez ignorer cet email.
		        </mj-text>
		        
		        <mj-text font-size="14px" color="#555555" align="center" padding-top="20px">
				  Si vous n'arrivez pas à cliquer sur le bouton, vous pouvez copier et coller ce lien dans votre navigateur : 
				</mj-text>
				
				<mj-text font-size="14px" color="#555555" align="center" padding-top="10px">
				  <a href="${verificationLink}" style="color: #4CAF50;">${verificationLink}</a>
				</mj-text>

		        <mj-divider border-color="#dddddd" border-width="1px" padding="20px 0" />

		        <mj-text font-size="12px" color="#aaaaaa" align="center">
		          GOTY © 2024. Tous droits réservés.<br />
		          123, Avenue du Jeu, Paris, France<br />
		          <a href="mailto:support@goty.com" style="color: #4CAF50; text-decoration: none;">Contactez-nous</a>
		        </mj-text>
		      </mj-column>
		    </mj-section>

		    <mj-section background-color="#4CAF50" padding="20px">
		      <mj-column>
		        <mj-text font-size="14px" color="#ffffff" align="center">
		          Suivez-nous sur nos réseaux sociaux :
		        </mj-text>
		        <mj-social font-size="14px" icon-size="30px" mode="horizontal" align="center">
		          <mj-social-element name="facebook" href="https://www.facebook.com/GOTY">
		            Facebook
		          </mj-social-element>
		          <mj-social-element name="twitter" href="https://www.twitter.com/GOTY">
		            Twitter
		          </mj-social-element>
		          <mj-social-element name="instagram" href="https://www.instagram.com/GOTY">
		            Instagram
		          </mj-social-element>
		        </mj-social>
		      </mj-column>
		    </mj-section>
		  </mj-body>
		</mjml>
	`);

	const mailOptions = {
		from: 'no-reply@goty.com',
		to: email,
		subject: 'Vérification de votre email',
		html: emailTemplate.html,
	};

	await transporter.sendMail(mailOptions);
}
