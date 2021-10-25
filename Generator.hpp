#ifndef GENERATOR_H
#define GENERATOR_H
#pragma once

#include <string>
#include <vector>
using std::string;
using std::vector;

class Generator {
private:
  string _group, _namespace_prefix;
  bool _cached, _completed;
  vector<string> _extentions;

public:
  Generator();
  virtual ~Generator();
  virtual string &group();
  virtual string &namespace_prefix();
  virtual bool &cached();
  virtual bool &completed();
  virtual vector<string> &extentions();
};
#endif