const mysql = require("mysql");
const inquirer = require("inquirer");
const cTable = require("console.table");
const dotenv = require("dotenv").config();

const connection = mysql.createConnection({
  host: "localhost",
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: "employee_managerdb",
});

function getAction() {
  return inquirer
    .prompt([
      {
        name: "action",
        type: "list",
        message: "What action would you like to take:",
        choices: ["Add", "View", "Update", "Exit"],
      },
    ])
    .then((answers) => {
      return answers.action;
    });
}

function handleAdd() {
  return inquirer
    .prompt([
      {
        name: "addType",
        type: "list",
        message: "What would you like to add:",
        choices: ["Department", "Role", "Employee"],
      },
    ])
    .then((answers) => {
      return answers.addType;
    });
}

function addDepartment() {
  return inquirer
    .prompt([
      {
        name: "depName",
        type: "input",
        message: "Enter the name of the department you want to add",
      },
    ])
    .then((answers) => {
      let query = "INSERT INTO department (name) VALUE ?";
      let values = [[answers.depName]];
      connection.query(query, [values], (err, data) => {
        if (err) throw err;
      });
    });
}

function addRole(deps) {
  return inquirer
    .prompt([
      {
        name: "title",
        type: "input",
        message: "Enter the job title:",
      },
      {
        name: "salary",
        type: "input",
        message: "Enter the job salary (per year)",
      },
      {
        name: "department",
        type: "list",
        message: "Enter the department that this role works under:",
        choices: deps,
      },
    ])
    .then((answers) => {
      let depID;
      connection.query(
        `SELECT id FROM department WHERE name="${answers.department}"`,
        (err, data) => {
          if (err) throw err;
          depID = data[0].id;
          let query = "INSERT INTO role (title, salary, department_id) VALUE ?";
          let values = [[answers.title, answers.salary, depID]];
          connection.query(query, [values], (err, data) => {
            if (err) throw err;
          });
        }
      );
    });
}

function addEmployee(roles, managers) {
  return inquirer
    .prompt([
      {
        name: "firstName",
        type: "input",
        message: "Enter the employees first name:",
      },
      {
        name: "lastName",
        type: "input",
        message: "Enter the employees last name:",
      },
      {
        name: "role",
        type: "list",
        message: "What job title does this employee have:",
        choices: roles,
      },
      {
        name: "manager",
        type: "list",
        message: "Who is this employee's manager (select NONE if N/A):",
        choices: managers,
      },
    ])
    .then((answers) => {
      //get role id
      connection.query(
        `SELECT id FROM role WHERE title="${answers.role}"`,
        (err, data) => {
          if (err) throw err;
          let roleID = data[0].id;
          //get manager if one is defined
          if (answers.manager != "NONE") {
            managerData = answers.manager.split(" ");
            managerName = managerData[0];
            connection.query(
              `SELECT id FROM employee WHERE first_name="${managerName}"`,
              (err, data) => {
                if (err) throw err;
                let manager = data[0].id;
                values = [
                  [answers.firstName, answers.lastName, roleID, manager],
                ];
                connection.query(
                  "INSERT INTO employee (first_name, last_name, role_id, manager_id) VALUE ?",
                  [values],
                  (err, data) => {
                    if (err) throw err;
                  }
                );
              }
            );
          } else {
            values = [[answers.firstName, answers.lastName, roleID]];
            connection.query(
              "INSERT INTO employee (first_name, last_name, role_id) VALUE ?",
              [values],
              (err, data) => {
                if (err) throw err;
              }
            );
          }
        }
      );
    });
}

function handleView() {
  return inquirer
    .prompt([
      {
        name: "viewType",
        type: "list",
        message: "What would you like to view:",
        choices: ["Departments", "Roles", "Employees"],
      },
    ])
    .then((answers) => {
      return answers.viewType;
    });
}

function handleUpdate(employeeList) {
  return inquirer
    .prompt([
      {
        name: "employee",
        type: "list",
        message: "Which employee are you updating:",
        choices: employeeList,
      },
    ])
    .then((answers) => {
      employeeName = answers.employee.split(" ");
      employeeLast = employeeName[1];
      return employeeLast;
    });
}

function getNewRole(roleList) {
  return inquirer
    .prompt([
      {
        name: "newRole",
        type: "list",
        message: "What is the employee's new role:",
        choices: roleList,
      },
    ])
    .then((answers) => {
      let role = answers.newRole.split(" ");
      let newRole = role[0];
      return newRole;
    });
}

async function main() {
  let userAction = await getAction();
  switch (userAction) {
    case "Add":
      let addType = await handleAdd();
      switch (addType) {
        case "Department":
          await addDepartment();
          main();
          break;
        case "Role":
          const allDeps = [];
          connection.query("SELECT * FROM department", async (err, data) => {
            if (err) throw err;
            for (department of data) {
              let depName = department.name;
              allDeps.push(depName);
            }
            await addRole(allDeps);
            main();
          });
          break;
        case "Employee":
          const allRoles = [];
          const allManagers = ["NONE"];
          connection.query("SELECT * FROM role", (err, data) => {
            if (err) throw err;
            for (role of data) {
              let roleName = role.title;
              allRoles.push(roleName);
            }
            connection.query(
              "SELECT employee.first_name, employee.last_name, role.title, department.name FROM ((employee INNER JOIN role ON role.id = employee.role_id) INNER JOIN department ON department.id = role.department_id)",
              async (err, data) => {
                if (err) throw err;
                for (employee of data) {
                  newEmp = `${employee.first_name} ${employee.last_name} - ${employee.name} - ${employee.title}`;
                  allManagers.push(newEmp);
                }
                await addEmployee(allRoles, allManagers);
                main();
              }
            );
          });
          break;
      }
      break;
    case "View":
      let viewType = await handleView();
      switch (viewType) {
        case "Employees":
          connection.query(
            "SELECT employee.first_name, employee.last_name, role.title, role.salary, department.name FROM ((employee INNER JOIN role ON role.id = employee.role_id) INNER JOIN department ON department.id = role.department_id)",
            async (err, data) => {
              if (err) throw err;
              console.table("Employee Data", data);
              setTimeout(function () {
                main();
              }, 2000);
            }
          );
          break;
        case "Departments":
          connection.query("SELECT * FROM department", (err, data) => {
            if (err) throw err;
            console.table("Departments", data);
            setTimeout(function () {
              main();
            }, 2000);
          });
          break;
        case "Roles":
          connection.query(
            "SELECT role.id, role.title, role.salary, department.name FROM (role INNER JOIN department ON department.id=role.department_id)",
            (err, data) => {
              if (err) throw err;
              console.table("Role Data", data);
              setTimeout(function () {
                main();
              }, 2000);
            }
          );
          break;
      }
      break;
    case "Update":
      let employeeList = [];
      connection.query(
        "SELECT employee.first_name, employee.last_name FROM employee",
        async (err, data) => {
          if (err) throw err;
          for (employee of data) {
            employeeName = `${employee.first_name} ${employee.last_name}`;
            employeeList.push(employeeName);
          }
          let employeeLast = await handleUpdate(employeeList);
          connection.query(
            "SELECT role.id, role.title, role.salary, department.name FROM (role INNER JOIN department ON department.id=role.department_id)",
            async (err, data) => {
              let roleList = [];
              if (err) throw err;
              for (role of data) {
                roleData = `${role.id} Role: ${role.title} - ${role.salary} Department: ${role.name}`;
                roleList.push(roleData);
              }
              let newRole = await getNewRole(roleList);
              connection.query(
                `UPDATE employee SET employee.role_id=${newRole} WHERE employee.last_name="${employeeLast}"`,
                (err, data) => {
                  if (err) throw err;
                  setTimeout(function () {
                    main();
                  }, 1000);
                }
              );
            }
          );
        }
      );
      break;
    case "Exit":
      connection.end();
      break;
  }
}

async function startUp() {
  connection.connect((err) => {
    if (err) throw err;
    console.log(`Connected at ${connection.threadId}`);
    let run = true;
    main();
  });
}

startUp();
