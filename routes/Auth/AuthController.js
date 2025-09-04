
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
//validate access token
const accessToken =async (req, res) => {  
  const user_id= req.user.id
  // console.log(user_id)
  const user_type=req.user.userType

  if(user_type =="ADM"){   
    const user=await prisma.users.findFirst({
      where:{
        id:user_id
      }
    })
  const staff = await prisma.staff_users.findFirst({
    where: {
      user_id:user?.user_id,
    },
    select: {
      division: true,
      department: true,
    },
  });

  const access = await prisma.user_access.findFirst({
    where: {
      user_type: user_type,
      division: staff?.division,
      department:{
        equals:staff?.department,
        mode:'insensitive'
      } 
    },
  }); 

  const division = staff?.division;
  const user_access = access?.access;
  // console.log(user_access)
  // console.log(division)

  res.status(200).json({
    user:true,
    division,
    logged_id:user_id,
    userType:user_type,
    roles:[user_type],
    allowedPages:user_access
  });
}else{   
   res.status(200).json({
    userType:user_type,
    logged_id:user_id,
    user:true,
    roles:[req.user.userType]
  });

}
};
const refreshToken = (req, res) => {
  // console.log("refresh api triggered")
  const user= req.user;

  const accessTokenPayload = {
    id: user.id,
    userType: user.userType,
  };
  const accessTokenOptions = {
    expiresIn: "10m",
  };
  const accessToken = jwt.sign(
    accessTokenPayload,
    process.env.ACCESS_TOKEN_SECRET,
    accessTokenOptions
  );
  res.status(201).json({ accessToken,logged_id:user.id,userType:user.userType,isUserAuthenticated:true });
};

module.exports = {
  accessToken,
  refreshToken,
};
