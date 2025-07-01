#!/bin/sh

d1=`dirname $0`
d2=`dirname $d1`
echo "======****===== Starting" >> prod.log
date >> prod.log
echo "Starting in directory $d2" >> prod.log
if (test "$d2" = "") then {
  d2="."
} fi;
. $d2/.env
su vtamara -c "cd $d2; make >> prod.log 2>&1 ; ./bin/start >> prod.log 2>&1 &"
