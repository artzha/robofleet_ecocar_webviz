import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  makeStyles,
  Theme,
} from '@material-ui/core';
import { Check, Clear } from '@material-ui/icons';
import React, {
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactElement,
} from 'react';
import { Link } from 'react-router-dom';
import NavBar from './components/NavBar';
import PercentageDisplay from './components/PercentageDisplay';
import AppContext from './contexts/AppContext';
import useRobofleetMsgListener from './hooks/useRobofleetMsgListener';
import { fb } from './schema';
import { matchTopicAnyNamespace } from './util';
import config from './config';
import IdTokenContext from './contexts/IdTokenContext';
import moment from 'moment';

type RobotStatus = {
  name: string;
  is_ok: boolean;
  battery_level: number;
  status: string;
  location: string;
  is_active: boolean;
  last_updated: string;
};

type StaticRobotInfo = {
  name: string;
  ip: string;
  lastStatus: string;
  lastLocation: string;
  lastUpdated: string;
};

const useStyles = makeStyles((theme: Theme) => ({
  inactive: {
    '& td': {
      color: theme.palette.grey[400],
    }
  },
}));

export default function Overview() {
  const { setPaused } = useContext(AppContext);
  const { idToken } = useContext(IdTokenContext);
  const [data, setData] = useState({} as { [name: string]: RobotStatus });
  const classes = useStyles();

  useEffect(() => {
    setPaused(false);
  }, [setPaused]);

  useRobofleetMsgListener(
    matchTopicAnyNamespace('status'),
    useCallback((buf, match) => {
      const name = match[1];
      const status = fb.amrl_msgs.RobofleetStatus.getRootAsRobofleetStatus(buf);
      setData((data) => ({
        ...data,
        [name]: {
          name: name,
          is_ok: status.isOk(),
          battery_level: status.batteryLevel(),
          status: status.status() ?? '',
          location: status.location() ?? '',
          is_active: true,
          last_updated: 'now',
        },
      }));
    }, [])
  );

  useEffect(() => {
    (async () => {
      const baseUrl = new URL(config.serverUrl);
      baseUrl.protocol = window.location.protocol;
      const url = new URL('robots', baseUrl).toString();
      const res = await fetch(url, {
        method: 'get',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      let robotInfo = await res.json();
      robotInfo.forEach((robot: StaticRobotInfo) => {
        const name = '/' + robot.name;
        if (!data[name]) {
          // don't overwrite any live robot data with this static info
          setData((data) => ({
            ...data,
            [name]: {
              name: name,
              is_ok: true,
              battery_level: 0,
              status: robot.lastStatus,
              location: robot.lastLocation,
              is_active: false,
              last_updated: moment(robot.lastUpdated).fromNow(),
            },
          }));
        }
      });
    })();
  }, [data]);

  const items = Object.entries(data).map(([name, obj]) => {
    let detailsContent: ReactElement | string;
    if (obj.is_active) {
      const href = `/robot/${btoa(name)}`;
      detailsContent = (
        <Button
          component={Link}
          to={href}
          size="small"
          variant="outlined"
          color="primary"
        >
          View
        </Button>
      );
    } else {
      detailsContent = `Last Seen: \n ${obj.last_updated}`;
    }

    return (
      <TableRow key={name} className={obj.is_active ? '' : classes.inactive}>
        <TableCell align="left">{name}</TableCell>
        <TableCell align="center">
          {obj.is_ok ? <Check /> : <Clear color="error" />}
        </TableCell>
        <TableCell align="center">
          <PercentageDisplay value={obj.battery_level} />
        </TableCell>
        <TableCell align="center">{obj.status}</TableCell>
        <TableCell align="center">{obj.location}</TableCell>
        <TableCell style={{ whiteSpace: 'pre-line' }} align="center">
          {detailsContent}
        </TableCell>
      </TableRow>
    );
  });

  return (
    <>
      <NavBar />
      <Box height="2em" />
      <Container component="main" maxWidth="md">
        <Typography
          variant="h3"
          component="h2"
          style={{ marginBottom: '0.25em' }}
        >
          Overview
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="left">Name</TableCell>
                <TableCell style={{ width: '3em' }} align="center">
                  OK
                </TableCell>
                <TableCell style={{ width: '5em' }} align="center">
                  Battery
                </TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Location</TableCell>
                <TableCell
                  style={{ width: '120px' }}
                  align="center"
                ></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>{items}</TableBody>
          </Table>
          <div
            style={{ padding: '1em', display: 'flex', alignItems: 'center' }}
          >
            <CircularProgress variant="indeterminate" disableShrink size={16} />
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ marginLeft: '1em' }}
            >
              Watching for new robots
            </Typography>
          </div>
        </TableContainer>
      </Container>
    </>
  );
}
