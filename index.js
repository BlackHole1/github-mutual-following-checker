const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

const argv = require('minimist')(process.argv.slice(2));

const GQL = `
query ($USER_NAME: String!, $AFTER: String) {
    user (login: $USER_NAME) {
        following (first: 20, after: $AFTER) {
            pageInfo {
                hasNextPage
                endCursor
            }
            nodes {
                avatarUrl
                name
                login
                isFollowingViewer
                url
                followers {
                    totalCount
                }
                following {
                    totalCount
                }
            }
        }
    }
}
`;

const getNotFollowingMeUserList = async () => {
    const result = [];

    const execute = async (after = undefined) => {
        const { data } = await axios.post('https://api.github.com/graphql', {
            query: GQL,
            variables: {
                USER_NAME: argv._[0] || process.env.GITHUB_USER_NAME,
                AFTER: after,
            },
        }, {
            headers: {
                Authorization: `bearer ${argv.token || process.env.GITHUB_TOKEN}`,
            }
        });

        const { pageInfo, nodes } = data.data.user.following;

        if (nodes.length === 0) {
            throw new Error('not following');
        }

        result.push(...nodes.filter(node => !node.isFollowingViewer));

        if (pageInfo.hasNextPage) {
            await execute(pageInfo.endCursor);
        }
    }

    await execute();

    return result;
}

getNotFollowingMeUserList()
    .then(list => {
        const folder = path.join(os.tmpdir(), "github-mutual-following-checker");

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder);
        }

        const tmpDir = fs.mkdtempSync(`${folder}${path.sep}`);
        const tmpFilePath = path.join(tmpDir, "index.html");
        fs.writeFileSync(tmpFilePath, html(list), {
            encoding: 'utf8',
        });

        console.log(`result: ${tmpFilePath}`);
    })
    .catch(console.error);

function html(list) {
    return `<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <title>User List</title>
    <style>
        table, th, td {
            border: 1px solid black;
        }
    </style>
</head>
<body>
    <table>
        <thead>
            <tr>
                <th>Avater</th>
                <th>Name</th>
                <th>followers</th>
                <th>following</th>
            </tr>
        </thead>
        <tbody id='tbody'>
        </tbody>
    </table>
</body>
<script>
    const list = ${JSON.stringify(list)};

    const tbody = document.getElementById('tbody');

    list.forEach(item => {
        const tr = document.createElement('tr');

        {
            const avaterTD = document.createElement('td');
            const img = document.createElement('img');
            img.src = item.avatarUrl;
            img.width = 60;
            avaterTD.appendChild(img);
            tr.appendChild(avaterTD);
        }

        {
            const name = document.createElement('td');
            const a = document.createElement('a');
            a.href = item.url;
            a.target = '_blank'
            a.textContent = item.name || item.login;
            name.appendChild(a);
            tr.appendChild(name);
        }

        {
            const followers = document.createElement('td');
            const span = document.createElement('span');
            span.textContent = item.followers.totalCount;
            followers.appendChild(span);
            tr.appendChild(followers);
        }

        {
            const following = document.createElement('td');
            const span = document.createElement('span');
            span.textContent = item.following.totalCount;
            following.appendChild(span);
            tr.appendChild(following)
        }

        tbody.appendChild(tr);
    });

</script>
</html>
`;
}