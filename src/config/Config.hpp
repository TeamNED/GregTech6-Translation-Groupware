#ifndef CONFIG_H
#define CONFIG_H
#pragma once

#include <memory>
#include <string>
#include <vector>

#include "../generator/Generator.hpp"

class ConfigParser;

class Config {
  friend ConfigParser;

private:
  string _lang, _version;
  vector<shared_ptr<Generator>> _generators;

public:
  Config() = default;
  Config(string lang);
  const string &lang() const;
  const string &version() const;
  const vector<shared_ptr<Generator>> &generators() const;
};
#endif