const { exec } = require('child_process');

// 定义一个函数来运行 npm 命令
function runNpm(project) {
  // 使用 exec 方法来执行 npm 命令，并捕获其输出
  const childProcess = exec('npm run dev', { cwd: project.path });

  // 每当子进程输出新的数据时，打印到控制台上
  childProcess.stdout.on('data', (data) => {
    console.log(`Project ${project.name} output: ${data}`);
  });

  // 当子进程退出时，打印其退出码
  childProcess.on('exit', (code) => {
    console.log(`Project ${project.name} exited with code ${code}`);
  });
}

// 启动两个子进程分别运行项目1和项目2
const projects = [
  { name: 'project1', path: './frontend' },
  { name: 'project2', path: './server' }
];

projects.forEach((project) => {
  runNpm(project);
});
